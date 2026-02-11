/**
 * Drink Window Debug Panel (DEV ONLY)
 * 
 * Tool for debugging and validating drink window classifications.
 * Shows all vintages for a wine, their computed status, and allows recomputation.
 * 
 * Features:
 * - Group wines by producer + name
 * - Show all vintages with their computed readiness
 * - Display raw inputs used for computation
 * - Highlight vintage inconsistencies
 * - Recompute drink windows for specific wines
 * - Validate consistency across entire cellar
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as bottleService from '../services/bottleService';
import * as aiAnalysisService from '../services/aiAnalysisService';
import * as drinkWindowService from '../services/drinkWindowService';
import { toast } from '../lib/toast';

export function DrinkWindowDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [bottles, setBottles] = useState<bottleService.BottleWithWineInfo[]>([]);
  const [selectedWine, setSelectedWine] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  
  // Load bottles
  useEffect(() => {
    if (isOpen) {
      loadBottles();
    }
  }, [isOpen]);
  
  async function loadBottles() {
    try {
      const data = await bottleService.listBottles();
      setBottles(data.filter(b => b.quantity > 0));
    } catch (error) {
      console.error('[Debug] Error loading bottles:', error);
    }
  }
  
  // Group bottles by wine identity
  const wineGroups = bottles.reduce((acc, bottle) => {
    const key = `${bottle.wine.producer || 'Unknown'}::${bottle.wine.wine_name}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(bottle);
    return acc;
  }, {} as Record<string, bottleService.BottleWithWineInfo[]>);
  
  // Sort groups by name
  const sortedGroups = Object.entries(wineGroups).sort((a, b) => a[0].localeCompare(b[0]));
  
  // Validate consistency
  async function validateConsistency() {
    setIsValidating(true);
    try {
      const results = await aiAnalysisService.validateDrinkWindowConsistency();
      setValidationResults(results);
      
      if (results.valid) {
        toast.success('✅ No consistency issues found!');
      } else {
        toast.error(`⚠️ Found ${results.issues.length} consistency issue(s)`);
      }
    } catch (error: any) {
      console.error('[Debug] Validation error:', error);
      toast.error(error.message);
    } finally {
      setIsValidating(false);
    }
  }
  
  // Recompute drink window for a specific wine group
  async function recomputeWineGroup(wineKey: string) {
    const groupBottles = wineGroups[wineKey];
    if (!groupBottles) return;
    
    try {
      toast.info(`Recomputing ${groupBottles.length} bottle(s)...`);
      
      for (const bottle of groupBottles) {
        await aiAnalysisService.generateAIAnalysis(bottle);
      }
      
      toast.success('✅ Recomputation complete!');
      await loadBottles();
    } catch (error: any) {
      console.error('[Debug] Recompute error:', error);
      toast.error(error.message);
    }
  }
  
  // Check if a wine has vintage consistency issues
  function hasConsistencyIssue(wineKey: string): boolean {
    if (!validationResults) return false;
    const [producer, name] = wineKey.split('::');
    return validationResults.issues.some(
      (issue: any) => 
        issue.producer.toLowerCase() === producer.toLowerCase() &&
        issue.wine.toLowerCase() === name.toLowerCase()
    );
  }
  
  // Get readiness label color
  function getReadinessColor(label: string): string {
    switch (label) {
      case 'READY': return '#22c55e';
      case 'HOLD': return '#3b82f6';
      case 'PEAK_SOON': return '#f59e0b';
      default: return '#6b7280';
    }
  }
  
  if (!isOpen) {
    // Floating debug button (bottom right)
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-50 p-3 rounded-full shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #a44d5a, #d4af37)',
          color: 'white',
        }}
        title="Drink Window Debug Panel (DEV)"
      >
        🔧
      </button>
    );
  }
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                🔧 Drink Window Debug Panel
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Validate and debug drink window classifications (DEV ONLY)
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          
          {/* Actions */}
          <div className="px-6 py-3 border-b border-gray-200 flex gap-2">
            <button
              onClick={validateConsistency}
              disabled={isValidating}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isValidating ? '#e5e7eb' : 'linear-gradient(135deg, #a44d5a, #d4af37)',
                color: 'white',
              }}
            >
              {isValidating ? 'Validating...' : '🔍 Validate Consistency'}
            </button>
            
            <button
              onClick={loadBottles}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          
          {/* Validation Results */}
          {validationResults && (
            <div className={`px-6 py-3 border-b ${validationResults.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {validationResults.valid ? '✅' : '⚠️'}
                </span>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">
                    {validationResults.valid 
                      ? 'All vintages consistent!' 
                      : `Found ${validationResults.issues.length} consistency issue(s)`}
                  </h3>
                  {!validationResults.valid && (
                    <ul className="mt-2 space-y-1">
                      {validationResults.issues.map((issue: any, idx: number) => (
                        <li key={idx} className="text-xs text-gray-700">
                          <strong>{issue.wine}</strong> ({issue.producer}): {issue.issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Wine Groups */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {sortedGroups.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No wines in cellar
                </p>
              )}
              
              {sortedGroups.map(([wineKey, groupBottles]) => {
                const [producer, name] = wineKey.split('::');
                const hasIssue = hasConsistencyIssue(wineKey);
                
                // Sort by vintage (oldest first)
                const sorted = [...groupBottles].sort((a, b) => 
                  (a.wine.vintage || 0) - (b.wine.vintage || 0)
                );
                
                return (
                  <div
                    key={wineKey}
                    className={`border-2 rounded-lg p-4 ${hasIssue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  >
                    {/* Wine Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{name}</h3>
                        <p className="text-sm text-gray-600">{producer}</p>
                        {hasIssue && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                            ⚠️ Vintage Inconsistency
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => recomputeWineGroup(wineKey)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        🔄 Recompute
                      </button>
                    </div>
                    
                    {/* Vintages */}
                    <div className="space-y-2">
                      {sorted.map(bottle => {
                        const analysis = bottle as any;
                        const age = bottle.wine.vintage 
                          ? new Date().getFullYear() - bottle.wine.vintage
                          : 0;
                        
                        return (
                          <div
                            key={bottle.id}
                            className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200"
                          >
                            {/* Vintage */}
                            <div className="w-16 text-center">
                              <div className="font-mono text-sm font-semibold">
                                {bottle.wine.vintage || 'NV'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {age}y
                              </div>
                            </div>
                            
                            {/* Status */}
                            <div className="flex-1">
                              <div
                                className="inline-block px-2 py-1 rounded text-xs font-semibold"
                                style={{
                                  backgroundColor: `${getReadinessColor(analysis.readiness_label)}20`,
                                  color: getReadinessColor(analysis.readiness_label),
                                }}
                              >
                                {analysis.readiness_label || 'UNANALYZED'}
                              </div>
                              {analysis.confidence && (
                                <span className="ml-2 text-xs text-gray-500">
                                  {analysis.confidence} confidence
                                </span>
                              )}
                            </div>
                            
                            {/* Window */}
                            {analysis.drink_window_start && analysis.drink_window_end && (
                              <div className="text-xs text-gray-600">
                                📅 {analysis.drink_window_start}-{analysis.drink_window_end}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-600">
              💡 <strong>Tip:</strong> Vintages should follow a monotonic pattern (older vintages should never be less ready than younger ones).
              Use "Validate Consistency" to check for issues.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
