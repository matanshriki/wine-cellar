/**
 * Vivino Export Guide Modal
 * 
 * Step-by-step wizard-like guide for exporting cellar data from Vivino WEB ONLY.
 * Mobile app export is NOT supported by Vivino.
 * 
 * Updated: December 2024
 * - Removed incorrect mobile export method
 * - Enhanced web export guide with clear step-by-step instructions
 * - Added prerequisite warnings
 * - Improved UX with wizard-like flow
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function VivinoExportGuide({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  const contentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Scroll to top when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDownloadTemplate = () => {
    // Create a sample Vivino CSV template
    const template = `Wine,Producer,Vintage,Type,Region,Country,Rating,Liter,Price,Quantity,Note
Château Margaux,Château Margaux,2015,Red,Margaux,France,4.5,0.75,150,2,Excellent Bordeaux for special occasions
Dom Pérignon,Moët & Chandon,2012,Sparkling,Champagne,France,4.7,0.75,200,1,Wedding gift
Sassicaia,Tenuta San Guido,2018,Red,Bolgheri,Italy,4.6,0.75,180,3,Great Tuscan Super Tuscan`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'vivino_template.csv';
    link.click();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60] ios-modal-scroll"
      style={{
        height: '100dvh',
      }}
    >
      <div 
        ref={contentRef}
        className="bg-white rounded-lg max-w-3xl w-full shadow-2xl touch-scroll safe-area-inset-bottom max-h-mobile-modal"
        style={{
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {t('vivinoGuide.title')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('vivinoGuide.subtitle')} ({currentStep}/{totalSteps})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            aria-label={t('common.close')}
            style={{
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-100 h-2 flex-shrink-0">
          <div 
            className="h-full bg-gradient-to-r from-wine-600 to-wine-700 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Step 0: Critical Warning */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">🚫</div>
                  <div>
                    <h3 className="font-bold text-red-900 text-lg mb-2">
                      {t('vivinoGuide.webOnly.title')}
                    </h3>
                    <p className="text-sm text-red-800 mb-3 font-medium">
                      {t('vivinoGuide.webOnly.description')}
                    </p>
                    <div className="bg-red-100 rounded-md p-3 text-sm text-red-900">
                      <p className="font-semibold mb-1">✓ {t('vivinoGuide.webOnly.works')}</p>
                      <p className="font-semibold">✗ {t('vivinoGuide.webOnly.doesntWork')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">💡</div>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">
                      {t('vivinoGuide.prerequisites.title')}
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>{t('vivinoGuide.prerequisites.item1')}</li>
                      <li>{t('vivinoGuide.prerequisites.item2')}</li>
                      <li>{t('vivinoGuide.prerequisites.item3')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Go to Vivino Website */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-wine-600 to-wine-700 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {t('vivinoGuide.step1.title')}
                  </h3>
                  <p className="text-gray-700 mb-4">
                    {t('vivinoGuide.step1.description')}
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="font-mono text-sm font-semibold text-wine-700">
                        https://www.vivino.com
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {t('vivinoGuide.step1.tip')}
                    </p>
                  </div>

                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-900">
                      <span className="font-semibold">⚠️ {t('common.important')}:</span> {t('vivinoGuide.step1.warning')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Navigate to My Wines */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-wine-600 to-wine-700 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {t('vivinoGuide.step2.title')}
                  </h3>
                  <p className="text-gray-700 mb-4">
                    {t('vivinoGuide.step2.description')}
                  </p>

                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-wine-500">
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        {t('vivinoGuide.step2.option1.title')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('vivinoGuide.step2.option1.description')}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-wine-500">
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        {t('vivinoGuide.step2.option2.title')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('vivinoGuide.step2.option2.description')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      <span className="font-semibold">💡 {t('common.tip')}:</span> {t('vivinoGuide.step2.tip')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Request Data Export from Vivino */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-wine-600 to-wine-700 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {t('vivinoGuide.step3.title')}
                  </h3>

                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">ℹ️</div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900 mb-2">
                          {t('vivinoGuide.step3.howItWorks.title')}
                        </p>
                        <p className="text-sm text-blue-800 mb-3">
                          {t('vivinoGuide.step3.howItWorks.description')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-wine-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        1
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {t('vivinoGuide.step3.substep1.title')}
                        </p>
                        <p className="text-sm text-gray-700">
                          {t('vivinoGuide.step3.substep1.description')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-wine-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        2
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {t('vivinoGuide.step3.substep2.title')}
                        </p>
                        <p className="text-sm text-gray-700">
                          {t('vivinoGuide.step3.substep2.description')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-wine-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        3
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {t('vivinoGuide.step3.substep3.title')}
                        </p>
                        <p className="text-sm text-gray-700">
                          {t('vivinoGuide.step3.substep3.description')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-wine-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        4
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {t('vivinoGuide.step3.substep4.title')}
                        </p>
                        <p className="text-sm text-gray-700">
                          {t('vivinoGuide.step3.substep4.description')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                    <p className="text-sm text-yellow-900">
                      <span className="font-semibold">⏳ {t('vivinoGuide.step3.timing.title')}:</span>{' '}
                      {t('vivinoGuide.step3.timing.description')}
                    </p>
                  </div>

                  <div className="mt-4 bg-white border-2 border-gray-300 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <span className="text-lg">💡</span>
                      {t('vivinoGuide.step3.alternative.title')}
                    </h4>
                    <p className="text-sm text-gray-700 mb-3">
                      {t('vivinoGuide.step3.alternative.description')}
                    </p>
                    <button
                      onClick={handleDownloadTemplate}
                      className="btn-luxury-secondary text-sm flex items-center gap-2"
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t('vivinoGuide.step3.alternative.download')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Import to Wine Cellar Brain */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-wine-600 to-wine-700 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {t('vivinoGuide.step4.title')}
                  </h3>
                  <p className="text-gray-700 mb-4">
                    {t('vivinoGuide.step4.description')}
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        1
                      </div>
                      <p className="text-sm text-gray-700 flex-1 pt-1">
                        {t('vivinoGuide.step4.substep1')}
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        2
                      </div>
                      <p className="text-sm text-gray-700 flex-1 pt-1">
                        {t('vivinoGuide.step4.substep2')}
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        3
                      </div>
                      <p className="text-sm text-gray-700 flex-1 pt-1">
                        {t('vivinoGuide.step4.substep3')}
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        4
                      </div>
                      <p className="text-sm text-gray-700 flex-1 pt-1">
                        {t('vivinoGuide.step4.substep4')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">🎉</div>
                      <div>
                        <p className="text-sm font-semibold text-green-900 mb-1">
                          {t('vivinoGuide.step4.success.title')}
                        </p>
                        <p className="text-sm text-green-800">
                          {t('vivinoGuide.step4.success.description')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Troubleshooting */}
                  <div className="mt-6 space-y-3">
                    <h4 className="font-bold text-gray-900 text-sm">
                      {t('vivinoGuide.troubleshooting.title')}
                    </h4>

                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                      <p className="font-semibold text-gray-900 text-sm mb-1">
                        {t('vivinoGuide.troubleshooting.q1.title')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('vivinoGuide.troubleshooting.q1.answer')}
                      </p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                      <p className="font-semibold text-gray-900 text-sm mb-1">
                        {t('vivinoGuide.troubleshooting.q2.title')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('vivinoGuide.troubleshooting.q2.answer')}
                      </p>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                      <p className="font-semibold text-gray-900 text-sm mb-1">
                        {t('vivinoGuide.troubleshooting.q3.title')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('vivinoGuide.troubleshooting.q3.answer')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Navigation */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={handlePrev}
                className="btn-luxury-secondary flex-1 sm:flex-initial"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                ← {t('common.back')}
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn-luxury-primary flex-1"
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              {currentStep < totalSteps ? `${t('common.next')} →` : t('vivinoGuide.gotIt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
