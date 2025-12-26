import { test, expect } from '@playwright/test'

test.describe('Basic User Flow', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)

    // Should show login form
    await expect(page.getByText(/Wine/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Send magic link/i })).toBeVisible()
  })

  test('should show email input', async ({ page }) => {
    await page.goto('/login')

    const emailInput = page.getByPlaceholder(/you@example.com/i)
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')
  })
})

// Note: Full authentication flow testing requires Supabase test credentials
// and is typically done in a staging environment

