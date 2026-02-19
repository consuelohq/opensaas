import { test, expect } from '@playwright/test';

test.describe.serial('Consuelo Contacts', () => {
  let personId: string;
  const testFirstName = 'John';
  const testLastName = 'Doe';
  const testPhone = '+15551234567';

  test('create new person record', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'People' }).click();
    await page.getByRole('button', { name: 'Create new record' }).click();

    await page.getByRole('textbox', { name: /First name/ }).fill(testFirstName);
    await page.getByPlaceholder('Last name').fill(testLastName);
    await page.getByPlaceholder('Last name').press('Enter');

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().postDataJSON()?.operationName === 'CreateOnePerson',
      ),
      page.keyboard.press('Enter'),
    ]);

    const body = await response.json();
    personId = body.data.createPerson.id;
    expect(personId).toBeDefined();
  });

  test('person appears in list view', async ({ page }) => {
    await page.goto('/objects/people');
    await expect(
      page.getByText(`${testFirstName} ${testLastName}`),
    ).toBeVisible();
  });

  test('edit person name', async ({ page }) => {
    await page.goto(`/objects/people/${personId}`);
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('textbox', { name: /First name/ }).fill('Jane');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Jane Doe')).toBeVisible();
  });

  test('add phone number to person', async ({ page }) => {
    await page.goto(`/objects/people/${personId}`);
    await page.getByText('Phones').click();
    await page.getByPlaceholder('Phone').fill(testPhone);
    await page.keyboard.press('Enter');
    await expect(page.getByText(testPhone)).toBeVisible();
  });

  test('search for person by name', async ({ page }) => {
    await page.goto('/objects/people');
    await page.getByPlaceholder('Search').fill('Jane Doe');
    await expect(page.getByText('Jane Doe')).toBeVisible();
  });

  test('delete person record', async ({ page }) => {
    await page.goto(`/objects/people/${personId}`);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.goto('/objects/people');
    await expect(page.getByText('Jane Doe')).not.toBeVisible();
  });
});
