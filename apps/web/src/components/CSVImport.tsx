import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import { VivinoExportGuide } from './VivinoExportGuide';
import { WineLoadingAnimation } from './WineLoadingAnimation';
import * as bottleService from '../services/bottleService';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

// Helper function to parse CSV text into rows
function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
}

// Helper function to detect Vivino format
function detectVivinoFormat(headers: string[]): { isVivino: boolean; confidence: number } {
  const vivinoHeaders = ['wine', 'producer', 'vintage', 'type', 'region', 'country', 'rating'];
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  let matchCount = 0;
  vivinoHeaders.forEach(vh => {
    if (lowerHeaders.some(h => h.includes(vh))) {
      matchCount++;
    }
  });
  
  const confidence = (matchCount / vivinoHeaders.length) * 100;
  return { isVivino: confidence > 60, confidence };
}

// Helper function to normalize wine type/color
function normalizeWineType(value: string): 'red' | 'white' | 'rose' | 'sparkling' {
  const lower = value.toLowerCase().trim();
  if (lower.includes('red')) return 'red';
  if (lower.includes('white')) return 'white';
  if (lower.includes('ros') || lower.includes('rose')) return 'rose';
  if (lower.includes('spark') || lower.includes('champagne') || lower.includes('cava') || lower.includes('prosecco')) return 'sparkling';
  return 'red'; // default
}

export function CSVImport({ onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'upload' | 'map'>('upload');
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [isVivino, setIsVivino] = useState(false);
  const [vivinoConfidence, setVivinoConfidence] = useState(0);
  const [showVivinoGuide, setShowVivinoGuide] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [mapping, setMapping] = useState({
    nameColumn: '',
    producerColumn: '',
    vintageColumn: '',
    regionColumn: '',
    regionalWineStyleColumn: '',
    countryColumn: '',
    grapesColumn: '',
    styleColumn: '',
    ratingColumn: '',
    vivinoUrlColumn: '',
    imageUrlColumn: '',
    quantityColumn: '',
    notesColumn: '',
  });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');

  // Scroll to top when step changes
  useEffect(() => {
    if (modalContentRef.current) {
      modalContentRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [step]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  }

  function handlePreview() {
    if (!csvText) {
      toast.error(t('csvImport.csvRequired'));
      return;
    }

    setLoading(true);
    try {
      // Parse CSV client-side
      const parsed = parseCSV(csvText);
      if (parsed.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }
      
      const parsedHeaders = parsed[0];
      const parsedRows = parsed.slice(1, 6); // Preview first 5 rows
      
      setHeaders(parsedHeaders);
      setRows(parsedRows);
      
      // Check for Vivino format
      const vivinoDetection = detectVivinoFormat(parsedHeaders);
      setIsVivino(vivinoDetection.isVivino);
      setVivinoConfidence(vivinoDetection.confidence);
      
      // Auto-map column names
      const autoMapping: any = {};
      
      // FIRST PASS: Look for high-priority exact matches (especially "Average rating")
      parsedHeaders.forEach((header: string) => {
        const lower = header.toLowerCase();
        // Priority: "Average rating" must be detected first, before any other rating column
        if (lower === 'average rating' || lower === 'avg rating' || lower === 'avg. rating' || lower === 'community rating') {
          autoMapping.ratingColumn = header;
        }
      });
      
      // SECOND PASS: Map all other columns (only if not already set)
      parsedHeaders.forEach((header: string) => {
        const lower = header.toLowerCase();
        if (lower.includes('name') || (lower === 'wine' && vivinoDetection.isVivino)) {
          autoMapping.nameColumn = header;
        } else if (lower.includes('producer') || lower.includes('winery')) {
          autoMapping.producerColumn = header;
        } else if (lower.includes('vintage') || lower.includes('year')) {
          autoMapping.vintageColumn = header;
        } else if ((lower.includes('regional') || lower.includes('region')) && (lower.includes('style') || lower.includes('wine style'))) {
          autoMapping.regionalWineStyleColumn = header;
        } else if (lower.includes('region') || lower.includes('appellation')) {
          autoMapping.regionColumn = header;
        } else if (lower.includes('country') || lower.includes('nation')) {
          autoMapping.countryColumn = header;
        } else if (lower.includes('grape') || lower.includes('varietal')) {
          autoMapping.grapesColumn = header;
        } else if (lower.includes('type') || lower.includes('style') || lower.includes('color')) {
          autoMapping.styleColumn = header;
        } else if (
          // Only match if rating column NOT already set by first pass
          !autoMapping.ratingColumn &&
          (
            (lower.includes('rating') && !lower.includes('rank')) ||
            (lower.includes('score') && !lower.includes('rank')) ||
            (lower.includes('average') && lower.includes('rating')) ||
            (lower.includes('avg') && lower.includes('rating'))
          )
        ) {
          autoMapping.ratingColumn = header;
        } else if (lower.includes('url') || lower.includes('link') || lower.includes('vivino')) {
          autoMapping.vivinoUrlColumn = header;
        } else if (lower.includes('image') || lower.includes('photo') || lower.includes('picture')) {
          autoMapping.imageUrlColumn = header;
        } else if (
          lower.includes('quantity') || 
          lower.includes('qty') || 
          lower.includes('bottles') ||
          lower.includes('cellar count') ||
          lower.includes('user cellar count') ||
          lower === 'count'
        ) {
          autoMapping.quantityColumn = header;
        } else if (lower.includes('note')) {
          autoMapping.notesColumn = header;
        }
      });
      
      setMapping((prev) => ({ ...prev, ...autoMapping }));
      
      // Log detected columns for debugging
      console.log('[CSV Import] CSV Headers:', parsedHeaders);
      
      // Show all columns that contain "rating" to help debug
      const ratingLikeColumns = parsedHeaders.filter(h => 
        h.toLowerCase().includes('rating') || h.toLowerCase().includes('score')
      );
      if (ratingLikeColumns.length > 0) {
        console.log('[CSV Import] 🔍 Rating-like columns found:', ratingLikeColumns);
        if (autoMapping.ratingColumn) {
          console.log(`[CSV Import] ✅ Auto-selected for RATING: "${autoMapping.ratingColumn}"`);
          
          // Verify it's the right one
          const isAverageRating = autoMapping.ratingColumn.toLowerCase().includes('average');
          if (isAverageRating) {
            console.log('[CSV Import] ✅ Perfect! "Average rating" was prioritized.');
          } else if (ratingLikeColumns.some(c => c.toLowerCase().includes('average'))) {
            console.error('[CSV Import] ❌ WARNING: "Average rating" exists but was NOT selected!');
            console.error('[CSV Import] This is a bug. Please report.');
          }
        }
      }
      
      console.log('[CSV Import] Auto-detected columns:', {
        name: autoMapping.nameColumn,
        producer: autoMapping.producerColumn,
        vintage: autoMapping.vintageColumn,
        region: autoMapping.regionColumn,
        country: autoMapping.countryColumn,
        style: autoMapping.styleColumn,
        rating: autoMapping.ratingColumn,
        quantity: autoMapping.quantityColumn,
        vivinoUrl: autoMapping.vivinoUrlColumn,
        imageUrl: autoMapping.imageUrlColumn,
      });
      
      // Warn if critical columns are missing
      if (!autoMapping.ratingColumn) {
        console.warn('[CSV Import] ⚠️ Rating column not detected! Check your CSV headers.');
        console.log('[CSV Import] Available rating-like columns:', ratingLikeColumns);
      }
      if (!autoMapping.quantityColumn) {
        console.warn('[CSV Import] ⚠️ Quantity column not detected! Will default to 1 per bottle.');
      }
      
      if (vivinoDetection.isVivino) {
        const mappedCount = Object.values(autoMapping).filter(v => v).length;
        toast.success(`🍷 Vivino format detected! Auto-mapped ${mappedCount} columns.`);
      }
      
      setStep('map');
    } catch (error: any) {
      toast.error(error.message || t('csvImport.parseFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!mapping.nameColumn || !mapping.styleColumn) {
      toast.error(t('csvImport.mappingRequired'));
      return;
    }

    setLoading(true);
    setImporting(true);
    setImportProgress(0);
    setImportMessage(t('csvImport.processing.preparing'));
    
    try {
      // Parse full CSV
      const parsed = parseCSV(csvText);
      const dataRows = parsed.slice(1).filter(row => !row.every(cell => !cell || !cell.trim())); // Skip header and empty rows
      
      if (dataRows.length === 0) {
        throw new Error('No data rows to import');
      }
      
      setImportMessage(t('csvImport.processing.found', { count: dataRows.length }));
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause to show message
      
      // Find column indices
      const nameIdx = headers.indexOf(mapping.nameColumn);
      const producerIdx = mapping.producerColumn ? headers.indexOf(mapping.producerColumn) : -1;
      const vintageIdx = mapping.vintageColumn ? headers.indexOf(mapping.vintageColumn) : -1;
      const regionIdx = mapping.regionColumn ? headers.indexOf(mapping.regionColumn) : -1;
      const regionalWineStyleIdx = mapping.regionalWineStyleColumn ? headers.indexOf(mapping.regionalWineStyleColumn) : -1;
      const countryIdx = mapping.countryColumn ? headers.indexOf(mapping.countryColumn) : -1;
      const grapesIdx = mapping.grapesColumn ? headers.indexOf(mapping.grapesColumn) : -1;
      const styleIdx = headers.indexOf(mapping.styleColumn);
      const ratingIdx = mapping.ratingColumn ? headers.indexOf(mapping.ratingColumn) : -1;
      const vivinoUrlIdx = mapping.vivinoUrlColumn ? headers.indexOf(mapping.vivinoUrlColumn) : -1;
      const imageUrlIdx = mapping.imageUrlColumn ? headers.indexOf(mapping.imageUrlColumn) : -1;
      const quantityIdx = mapping.quantityColumn ? headers.indexOf(mapping.quantityColumn) : -1;
      const notesIdx = mapping.notesColumn ? headers.indexOf(mapping.notesColumn) : -1;
      
      let successCount = 0;
      let failureCount = 0;
      const totalRows = dataRows.length;
      
      // Log column indices for debugging
      console.log('[CSV Import] Column indices:', {
        ratingIdx,
        quantityIdx,
        vivinoUrlIdx,
        imageUrlIdx
      });
      
      // Log first row data for debugging
      if (dataRows.length > 0) {
        const firstRow = dataRows[0];
        const sampleRating = ratingIdx >= 0 ? firstRow[ratingIdx] : 'N/A';
        
        console.log('[CSV Import] First row sample:', {
          wineName: firstRow[nameIdx],
          rating: sampleRating,
          quantity: quantityIdx >= 0 ? firstRow[quantityIdx] : 'N/A',
          vivinoUrl: vivinoUrlIdx >= 0 ? firstRow[vivinoUrlIdx] : 'N/A',
        });
        
        // Validate rating looks correct (should be 0-5, not 100+)
        if (ratingIdx >= 0 && sampleRating !== 'N/A') {
          const ratingValue = parseFloat(sampleRating.toString().replace(',', '.'));
          if (!isNaN(ratingValue) && ratingValue > 100) {
            console.error(
              `[CSV Import] ❌ WRONG COLUMN DETECTED! ` +
              `Column "${headers[ratingIdx]}" has value ${ratingValue}, ` +
              `which looks like a RANKING (global position), not a RATING (0-5 scale). ` +
              `Please manually select the "Average rating" column in the mapping step.`
            );
            toast.error('⚠️ Wrong rating column detected! Please select "Average rating" manually in the next step.');
          }
        }
      }
      
      // Import each row
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const wineName = row[nameIdx]?.trim();
        
        // Update progress
        const progress = ((i + 1) / totalRows) * 100;
        setImportProgress(progress);
        setImportMessage(t('csvImport.processing.importing', { 
          current: i + 1, 
          total: totalRows,
          wine: wineName || '...'
        }));
        
        try {
          const styleValue = row[styleIdx]?.trim();
          
          if (!wineName || !styleValue) {
            failureCount++;
            continue;
          }
          
          // Parse rating (Vivino format is usually "4.2" or similar)
          // Handle both dot (4.2) and comma (4,2) decimal separators
          let rating: number | null = null;
          if (ratingIdx >= 0 && row[ratingIdx]) {
            let ratingStr = row[ratingIdx].trim();
            // Replace comma with dot for European format (e.g., 4,2 → 4.2)
            ratingStr = ratingStr.replace(',', '.');
            const ratingNum = parseFloat(ratingStr);
            // Vivino ratings are 0-5 scale, clamp to valid range
            if (!isNaN(ratingNum)) {
              if (ratingNum >= 0 && ratingNum <= 5) {
                rating = ratingNum;
                // Log first few ratings to help debug
                if (successCount < 3) {
                  console.log(`[CSV Import] Parsed rating for "${wineName}": ${rating}`);
                }
              } else if (ratingNum > 5) {
                // If rating is out of range, assume it might be a different scale
                console.warn(`[CSV Import] Rating ${ratingNum} for "${wineName}" is out of Vivino's 0-5 range, skipping`);
              }
            }
          }
          
          // Get Vivino URL if available
          const vivinoUrl = vivinoUrlIdx >= 0 ? row[vivinoUrlIdx]?.trim() : null;
          
          // Get image URL if available
          const imageUrl = imageUrlIdx >= 0 ? row[imageUrlIdx]?.trim() : null;
          
          // Build bottle data
          const bottleInput: bottleService.CreateBottleInput = {
            wine_name: wineName,
            producer: producerIdx >= 0 ? row[producerIdx]?.trim() : 'Unknown',
            vintage: vintageIdx >= 0 && row[vintageIdx] ? parseInt(row[vintageIdx]) : null,
            region: regionIdx >= 0 ? row[regionIdx]?.trim() : null,
            regional_wine_style: regionalWineStyleIdx >= 0 ? row[regionalWineStyleIdx]?.trim() : null,
            country: countryIdx >= 0 ? row[countryIdx]?.trim() : null,
            grapes: grapesIdx >= 0 && row[grapesIdx] ? 
              row[grapesIdx].split(/[,;]/).map(g => g.trim()).filter(Boolean) : null,
            color: normalizeWineType(styleValue),
            appellation: null,
            vivino_wine_id: null,
            rating: rating,
            vivino_url: vivinoUrl,
            image_url: imageUrl,
            wine_notes: null,
            quantity: quantityIdx >= 0 && row[quantityIdx] ? parseInt(row[quantityIdx]) : 1,
            notes: notesIdx >= 0 ? row[notesIdx]?.trim() : null,
            purchase_price: null,
            purchase_date: null,
            purchase_location: null,
            storage_location: null,
            bottle_size_ml: 750,
            tags: null,
          };
          
          await bottleService.createBottle(bottleInput);
          successCount++;
        } catch (error) {
          console.error('Failed to import row:', row, error);
          failureCount++;
        }
      }
      
      // Final success message
      setImportProgress(100);
      setImportMessage(t('csvImport.processing.complete'));
      await new Promise(resolve => setTimeout(resolve, 800)); // Show completion
      
      if (successCount > 0) {
        toast.success(`${t('csvImport.success')} (${successCount} ${t('csvImport.imported')}${failureCount > 0 ? `, ${failureCount} ${t('csvImport.failed')}` : ''})`);
        onSuccess();
      } else {
        throw new Error('No bottles were imported successfully');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || t('csvImport.importFailed'));
    } finally {
      setLoading(false);
      setImporting(false);
      setImportProgress(0);
    }
  }

  function downloadTemplate() {
    const template = `name,producer,vintage,region,grapes,style,rating,quantity,notes
Château Margaux,Château Margaux,2015,"Bordeaux, France","Cabernet Sauvignon, Merlot",red,98,2,Premier Grand Cru
Dom Pérignon,Moët & Chandon,2012,"Champagne, France","Chardonnay, Pinot Noir",sparkling,97,1,Vintage champagne
Cloudy Bay,Cloudy Bay,2022,"Marlborough, NZ",Sauvignon Blanc,white,90,3,Crisp and refreshing`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wine-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadVivinoSample() {
    const vivinoTemplate = `Wine,Producer,Vintage,Type,Region,Country,Rating,Quantity,Notes
Sassicaia,Tenuta San Guido,2017,Red,Tuscany,Italy,4.6,2,Super Tuscan blend
Sancerre Blanc,Domaine Vacheron,2021,White,Loire Valley,France,4.2,3,Classic Sauvignon Blanc
Châteauneuf-du-Pape,Domaine du Vieux Télégraphe,2019,Red,Rhône Valley,France,4.5,1,Full-bodied Grenache blend`;

    const blob = new Blob([vivinoTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vivino-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 ios-modal-scroll"
      style={{
        height: '100dvh',
      }}
    >
      <div 
        ref={modalContentRef}
        className="bg-white rounded-lg max-w-4xl w-full touch-scroll safe-area-inset-bottom max-h-mobile-modal"
        style={{
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('csvImport.title')}</h2>
        </div>

        <div className="p-4 sm:p-6">
          {step === 'upload' && (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <p className="text-sm sm:text-base text-gray-600 mb-3">
                  {t('csvImport.upload.subtitle')}
                </p>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4 mb-4">
                  <h3 className="font-semibold text-sm sm:text-base text-purple-900 mb-2 flex items-center gap-2">
                    🍷 {t('csvImport.upload.vivino.title')}
                  </h3>
                  <p className="text-xs sm:text-sm text-purple-700 mb-3">
                    {t('csvImport.upload.vivino.description')}
                  </p>
                  
                  {/* Connect Vivino - Stub with explanation */}
                  <div className="bg-gray-100 border border-gray-300 rounded-md p-3 mb-3 opacity-75">
                    <button
                      disabled
                      className="w-full sm:w-auto btn-luxury-secondary text-sm mb-2 opacity-50 cursor-not-allowed"
                      title={t('csvImport.upload.vivino.connectUnavailable')}
                    >
                      <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      {t('csvImport.upload.vivino.connectButton')}
                    </button>
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold">❌ {t('csvImport.upload.vivino.whyUnavailable.title')}:</span>{' '}
                      {t('csvImport.upload.vivino.whyUnavailable.description')}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setShowVivinoGuide(true)}
                    className="text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-medium underline flex items-center gap-1 min-h-[44px] py-2"
                    style={{
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    📖 {t('csvImport.upload.vivino.guide')} →
                  </button>
                </div>
                
                <div className="flex flex-col xs:flex-row gap-2 xs:gap-3 mb-4">
                  <button
                    onClick={downloadTemplate}
                    className="text-xs sm:text-sm text-primary-600 hover:text-primary-700"
                  >
                    📥 {t('csvImport.upload.downloadStandard')}
                  </button>
                  <span className="hidden xs:inline text-gray-300">|</span>
                  <button
                    onClick={downloadVivinoSample}
                    className="text-xs sm:text-sm text-primary-600 hover:text-primary-700"
                  >
                    📥 {t('csvImport.upload.downloadVivino')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('csvImport.upload.chooseFile')}
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-xs sm:text-sm text-gray-500 file:mr-3 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>

              {csvText && (
                <div className="p-3 sm:p-4 bg-green-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-green-800">✅ {t('csvImport.upload.fileLoaded')}</p>
                </div>
              )}

              <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button onClick={onClose} className="flex-1 btn btn-secondary text-sm sm:text-base">
                  {t('csvImport.upload.cancel')}
                </button>
                <button
                  onClick={handlePreview}
                  className="flex-1 btn btn-primary text-sm sm:text-base"
                  disabled={!csvText || loading}
                >
                  {loading ? t('csvImport.upload.processing') : t('csvImport.upload.next')}
                </button>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-3 sm:space-y-4">
              {isVivino && (
                <div className="p-3 sm:p-4 bg-purple-50 border border-purple-200 rounded-lg mb-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="text-xl sm:text-2xl flex-shrink-0">🍷</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-purple-900 mb-1">
                        {t('csvImport.mapping.vivinoDetected.title')}
                      </h3>
                      <p className="text-xs sm:text-sm text-purple-700">
                        {t('csvImport.mapping.vivinoDetected.description')}
                      </p>
                      <p className="text-xs text-purple-600 mt-2">
                        {t('csvImport.mapping.vivinoDetected.confidence', { percent: Math.round(vivinoConfidence * 100) })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
                {t('csvImport.mapping.instructions')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.name')} *
                  </label>
                  <select
                    value={mapping.nameColumn}
                    onChange={(e) => setMapping({ ...mapping, nameColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.select')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.style')} *
                  </label>
                  <select
                    value={mapping.styleColumn}
                    onChange={(e) => setMapping({ ...mapping, styleColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.select')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.producer')}
                  </label>
                  <select
                    value={mapping.producerColumn}
                    onChange={(e) => setMapping({ ...mapping, producerColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.vintage')}
                  </label>
                  <select
                    value={mapping.vintageColumn}
                    onChange={(e) => setMapping({ ...mapping, vintageColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.region')}
                  </label>
                  <select
                    value={mapping.regionColumn}
                    onChange={(e) => setMapping({ ...mapping, regionColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.regionalWineStyle')}
                  </label>
                  <select
                    value={mapping.regionalWineStyleColumn}
                    onChange={(e) => setMapping({ ...mapping, regionalWineStyleColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.country')}
                  </label>
                  <select
                    value={mapping.countryColumn}
                    onChange={(e) => setMapping({ ...mapping, countryColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.grapes')}
                  </label>
                  <select
                    value={mapping.grapesColumn}
                    onChange={(e) => setMapping({ ...mapping, grapesColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.rating')}
                  </label>
                  <select
                    value={mapping.ratingColumn}
                    onChange={(e) => setMapping({ ...mapping, ratingColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    {t('csvImport.mapping.columns.quantity')}
                  </label>
                  <select
                    value={mapping.quantityColumn}
                    onChange={(e) => setMapping({ ...mapping, quantityColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Vivino URL (optional)
                  </label>
                  <select
                    value={mapping.vivinoUrlColumn}
                    onChange={(e) => setMapping({ ...mapping, vivinoUrlColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Image URL (optional)
                  </label>
                  <select
                    value={mapping.imageUrlColumn}
                    onChange={(e) => setMapping({ ...mapping, imageUrlColumn: e.target.value })}
                    className="input"
                  >
                    <option value="">{t('csvImport.mapping.columns.skip')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 sm:mt-6">
                <h3 className="font-medium text-sm sm:text-base text-gray-900 mb-2">
                  {t('csvImport.mapping.preview')}
                </h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                      <thead className="bg-white border-b-2 border-gray-200">
                        <tr>
                          {headers.map((h) => (
                            <th key={h} className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j} className="px-2 sm:px-3 py-2 whitespace-nowrap text-gray-600">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button onClick={() => setStep('upload')} className="flex-1 btn btn-secondary text-sm sm:text-base">
                  {t('csvImport.mapping.back')}
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 btn btn-primary text-sm sm:text-base"
                  disabled={!mapping.nameColumn || !mapping.styleColumn || loading}
                >
                  {loading ? t('csvImport.mapping.importing') : t('csvImport.mapping.import')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vivino Export Guide Modal */}
      <VivinoExportGuide
        isOpen={showVivinoGuide}
        onClose={() => setShowVivinoGuide(false)}
      />

      {/* Import Loading Overlay */}
      {importing && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] backdrop-blur-sm"
          style={{
            height: '100dvh',
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-4 safe-area-inset-bottom">
            <WineLoadingAnimation
              message={importMessage}
              showProgress={true}
              progress={importProgress}
            />
          </div>
        </div>
      )}
    </div>
  );
}

