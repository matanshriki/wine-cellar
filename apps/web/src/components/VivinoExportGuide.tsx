/**
 * Vivino Export Guide Modal
 * 
 * Step-by-step guide for exporting cellar data from Vivino.
 * Includes placeholder images and clear instructions.
 */

import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function VivinoExportGuide({ isOpen, onClose }: Props) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60] ios-modal-scroll"
      style={{
        height: '100dvh',
      }}
    >
      <div 
        className="bg-white rounded-lg max-w-3xl w-full shadow-2xl touch-scroll safe-area-inset-bottom"
        style={{
          maxHeight: 'calc(100dvh - 2rem)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {t('vivinoGuide.title')}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('vivinoGuide.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
            aria-label={t('common.close')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Important Note */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">⚠️</div>
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">
                  {t('vivinoGuide.note.title')}
                </h3>
                <p className="text-sm text-yellow-800">
                  {t('vivinoGuide.note.description')}
                </p>
              </div>
            </div>
          </div>

          {/* Method 1: Mobile App Export */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
              {t('vivinoGuide.method1.title')}
            </h3>

            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {t('vivinoGuide.method1.step1.title')}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {t('vivinoGuide.method1.step1.description')}
                  </p>
                </div>
              </div>
              <div className="ms-11 bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                <div className="text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs">{t('vivinoGuide.screenshot.placeholder')}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('vivinoGuide.screenshot.todo')}
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {t('vivinoGuide.method1.step2.title')}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {t('vivinoGuide.method1.step2.description')}
                  </p>
                </div>
              </div>
              <div className="ms-11 bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                <div className="text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs">{t('vivinoGuide.screenshot.placeholder')}</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {t('vivinoGuide.method1.step3.title')}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {t('vivinoGuide.method1.step3.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Method 2: Web Export (Alternative) */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
              {t('vivinoGuide.method2.title')}
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">ℹ️</div>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">
                    {t('vivinoGuide.method2.info.title')}
                  </h4>
                  <p className="text-sm text-blue-800 mb-2">
                    {t('vivinoGuide.method2.info.description')}
                  </p>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>{t('vivinoGuide.method2.step1')}</li>
                    <li>{t('vivinoGuide.method2.step2')}</li>
                    <li>{t('vivinoGuide.method2.step3')}</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* What to do with the CSV */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
              {t('vivinoGuide.afterExport.title')}
            </h3>

            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  {t('vivinoGuide.afterExport.step1')}
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  {t('vivinoGuide.afterExport.step2')}
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  {t('vivinoGuide.afterExport.step3')}
                </p>
              </li>
            </ol>
          </div>

          {/* Troubleshooting */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
              {t('vivinoGuide.troubleshooting.title')}
            </h3>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-semibold text-gray-900 text-sm mb-1">
                  {t('vivinoGuide.troubleshooting.q1.title')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('vivinoGuide.troubleshooting.q1.answer')}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-semibold text-gray-900 text-sm mb-1">
                  {t('vivinoGuide.troubleshooting.q2.title')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('vivinoGuide.troubleshooting.q2.answer')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4">
          <button
            onClick={onClose}
            className="w-full btn btn-primary"
          >
            {t('vivinoGuide.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}

