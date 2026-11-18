import { expect, test } from '@playwright/test';
import { DESKTOP, PHONE, USERS, api, pressToggle, signInAs, unique } from './helpers';

test('start a circle, join it from the list, approve, and talk', async ({ browser, request }) => {
  const name = unique('Sunday Cricket');

  // Ashutosh starts a circle through the form
  const owner = await (await browser.newContext({ viewport: DESKTOP })).newPage();
  await signInAs(owner, USERS.ashutosh);
  await owner.goto('/circles/create');
  // Choosing the type first also waits for the form to be ready
  await pressToggle(owner.getByRole('button', { name: 'Sports', exact: true }));
  await pressToggle(owner.getByRole('button', { name: 'Box Cricket', exact: true }));
  await owner.getByLabel('Name').fill(name);
  await expect(owner.getByLabel('Name')).toHaveValue(name);
  await owner.getByLabel('Description').fill('Box cricket every Sunday at 7 am. All levels welcome.');
  await owner.getByLabel(/WhatsApp group invite link/).fill('https://chat.whatsapp.com/AbCdEfGhIj1234');
  await owner.getByRole('button', { name: 'Send for approval' }).click();
  await expect(owner.getByRole('heading', { name: 'Circle created' })).toBeVisible();
  await owner.waitForURL((u) => /\/circles\/cir-/.test(u.pathname));
  const circleId = owner.url().split('/').pop()!;

  // A society admin approves it
  await api(request, USERS.admin, 'PATCH', '/api/v1/circles', { circleId, action: 'APPROVE' });

  // Priya asks to join straight from the list, on her phone
  const member = await (await browser.newContext({ viewport: PHONE })).newPage();
  await signInAs(member, USERS.priya);
  await member.goto('/circles');
  await member.getByRole('button', { name: `I'm interested in ${name}` }).click();
  await expect(member.locator('article').filter({ hasText: name }).getByText('Request sent')).toBeVisible();

  // Ashutosh approves her request on the circle page
  await owner.goto(`/circles/${circleId}`);
  await owner.getByRole('button', { name: 'Approve' }).click();
  await expect(owner.getByText('No one is waiting.')).toBeVisible();

  // Priya now sees the members' section and sends a message
  await member.goto(`/circles/${circleId}`);
  await expect(member.getByRole('link', { name: 'Open WhatsApp group' })).toBeVisible();
  await member.getByRole('link', { name: /^Messages/ }).click();
  const box = member.getByRole('textbox', { name: 'Your message' });
  await box.fill('Count me in 😀');
  await expect(member.getByText('Emoji are not allowed in circle messages.')).toBeVisible();
  await box.fill('Count me in. I will bring the ball.');
  await member.getByRole('button', { name: 'Send' }).click();
  await expect(member.getByRole('log')).toContainText('I will bring the ball.');

  // Ashutosh sees it in the circle's messages
  await owner.goto(`/circles/${circleId}/messages`);
  await expect(owner.getByRole('log')).toContainText('I will bring the ball.');

  // A society admin who has not joined can join, but sees nothing inside
  const admin = await (await browser.newContext({ viewport: PHONE })).newPage();
  await signInAs(admin, USERS.admin);
  await admin.goto(`/circles/${circleId}`);
  await expect(admin.getByRole('button', { name: "I'm interested" })).toBeVisible();
  await expect(admin.getByRole('heading', { name: 'Manage' })).toBeVisible();
  await expect(admin.getByText('Open WhatsApp group')).toHaveCount(0);
  await admin.goto(`/circles/${circleId}/messages`);
  await expect(admin.getByText('Messages are for members')).toBeVisible();
});
