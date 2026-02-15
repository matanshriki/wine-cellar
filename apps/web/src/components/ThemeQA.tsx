/**
 * Theme QA Component
 * 
 * DEV-ONLY visual regression checker to verify:
 * - White mode matches pre-theme baseline exactly
 * - Red mode looks premium and readable
 * 
 * Check this component in both themes to ensure no typography/color regressions.
 */

import { useTheme } from '../contexts/ThemeContext';

export function ThemeQA() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen p-8 space-y-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Theme QA Checklist</h1>
          <p className="text-lg" style={{ color: 'var(--text-primary)' }}>
            Current theme: <strong>{theme}</strong>
          </p>
          <p className="text-sm text-stone-500 mt-2">
            Use this page to verify typography and colors match the expected baseline.
          </p>
        </div>

        {/* Typography Scale */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Typography Scale</h2>
          <div className="space-y-3">
            <h1>H1: Wine Cellar Management</h1>
            <h2>H2: Organize Your Collection</h2>
            <h3>H3: Premium Features</h3>
            <h4>H4: Bottle Details</h4>
            <p className="text-base" style={{ color: 'var(--text-primary)' }}>
              Body text (text-primary): The quick brown fox jumps over the lazy dog. 
              This is the default body text that appears throughout the app.
            </p>
            <p className="text-sm text-stone-700">
              Secondary text: Additional information and descriptions appear in this style.
            </p>
            <p className="text-sm text-stone-500">
              Tertiary/muted text: Timestamps, metadata, and supporting details.
            </p>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <button className="px-6 py-3 bg-wine-600 text-white rounded-lg font-medium hover:bg-wine-700 transition-colors">
              Primary Button
            </button>
            <button className="px-6 py-3 bg-stone-100 text-stone-900 rounded-lg font-medium hover:bg-stone-200 transition-colors">
              Secondary Button
            </button>
            <button className="px-6 py-3 border border-stone-300 text-stone-700 rounded-lg font-medium hover:border-stone-400 hover:bg-stone-50 transition-colors">
              Outline Button
            </button>
            <button className="px-6 py-3 text-stone-600 rounded-lg font-medium hover:bg-stone-100 transition-colors">
              Ghost Button
            </button>
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-white border border-stone-200 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Tonight's Selection</h3>
              <p className="text-stone-700 mb-3">
                Perfect bottles ready to drink right now based on readiness scores and your preferences.
              </p>
              <p className="text-sm text-stone-500">
                3 bottles ready • Updated 2 hours ago
              </p>
            </div>
            <div className="p-6 bg-white border border-stone-200 rounded-lg shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Cellar Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-600">Total bottles</span>
                  <span className="font-semibold text-stone-900">127</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Ready to drink</span>
                  <span className="font-semibold text-wine-600">23</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chat Bubbles */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Chat Bubbles</h2>
          <div className="space-y-3">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-md p-4 bg-wine-600 text-white rounded-2xl rounded-tr-sm">
                <p className="text-sm">
                  What wines pair well with grilled salmon?
                </p>
              </div>
            </div>
            {/* Assistant message */}
            <div className="flex justify-start">
              <div className="max-w-md p-4 bg-stone-100 text-stone-900 rounded-2xl rounded-tl-sm">
                <p className="text-sm">
                  For grilled salmon, I recommend a dry Rosé or a light Pinot Noir. 
                  You have a 2019 Willamette Valley Pinot Noir that would be perfect!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Status Colors */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Status Colors</h2>
          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
              Ready to drink
            </div>
            <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-sm font-medium">
              Approaching peak
            </div>
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium">
              Hold for aging
            </div>
            <div className="px-4 py-2 bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-sm font-medium">
              Unknown
            </div>
          </div>
        </section>

        {/* Form Inputs */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Form Inputs</h2>
          <div className="space-y-3 max-w-md">
            <input
              type="text"
              placeholder="Wine name"
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wine-500 focus:border-transparent"
            />
            <select className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wine-500 focus:border-transparent">
              <option>Select a producer</option>
              <option>Château Margaux</option>
              <option>Domaine de la Romanée-Conti</option>
            </select>
            <textarea
              placeholder="Tasting notes"
              rows={3}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-wine-500 focus:border-transparent"
            />
          </div>
        </section>

        {/* Modal Simulation */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Modal Example</h2>
          <div className="max-w-md mx-auto p-6 bg-white border border-stone-200 rounded-2xl shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Add Bottle</h3>
            <p className="text-stone-700 mb-6">
              Fill in the details below to add a new bottle to your cellar.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Wine name"
                className="w-full px-4 py-3 border border-stone-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Vintage"
                className="w-full px-4 py-3 border border-stone-300 rounded-lg"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button className="flex-1 px-4 py-3 bg-stone-100 text-stone-700 rounded-lg font-medium">
                Cancel
              </button>
              <button className="flex-1 px-4 py-3 bg-wine-600 text-white rounded-lg font-medium">
                Add Bottle
              </button>
            </div>
          </div>
        </section>

        {/* Color Reference */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">Color Variables</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="h-16 rounded-lg border" style={{ backgroundColor: 'var(--bg)' }} />
              <p className="mt-1 font-mono">--bg</p>
            </div>
            <div>
              <div className="h-16 rounded-lg border" style={{ backgroundColor: 'var(--bg-surface)' }} />
              <p className="mt-1 font-mono">--bg-surface</p>
            </div>
            <div>
              <div className="h-16 rounded-lg border" style={{ backgroundColor: 'var(--text-primary)' }} />
              <p className="mt-1 font-mono">--text-primary</p>
            </div>
            <div>
              <div className="h-16 rounded-lg border" style={{ backgroundColor: 'var(--text-secondary)' }} />
              <p className="mt-1 font-mono">--text-secondary</p>
            </div>
            <div>
              <div className="h-16 rounded-lg border" style={{ backgroundColor: 'var(--border-medium)' }} />
              <p className="mt-1 font-mono">--border-medium</p>
            </div>
            <div>
              <div className="h-16 rounded-lg border" style={{ backgroundColor: 'var(--wine-600)' }} />
              <p className="mt-1 font-mono">--wine-600</p>
            </div>
          </div>
        </section>

        {/* Checklist */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">QA Checklist</h2>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">Body text is readable and not too dark/light</div>
                <div className="text-sm text-stone-600">White: stone-900, Red: warm off-white</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">Headings are distinct from body text</div>
                <div className="text-sm text-stone-600">White: stone-950, Red: bright off-white</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">Buttons have good contrast and are clickable</div>
                <div className="text-sm text-stone-600">Primary buttons use wine colors</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">Chat bubbles are readable</div>
                <div className="text-sm text-stone-600">User: wine-600 bg, Assistant: stone-100 bg</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">Forms and inputs are properly styled</div>
                <div className="text-sm text-stone-600">Borders visible, focus states work</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">Cards have proper shadows and separation</div>
                <div className="text-sm text-stone-600">White backgrounds with subtle borders</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">No unexpected font changes</div>
                <div className="text-sm text-stone-600">Display for headings, Body for text</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-stone-50">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-medium">Red theme feels premium (not neon/oversaturated)</div>
                <div className="text-sm text-stone-600">Deep blacks, warm text, subtle wine accents</div>
              </div>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
