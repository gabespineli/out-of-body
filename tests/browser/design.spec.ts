import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { silhouetteSvg } from "../../src/lib/rig";

async function fonts(page: import('@playwright/test').Page) {
  await page.evaluate(async () => { await document.fonts.load('700 20px Urbanist'); await document.fonts.load('italic 600 30px "Hatch Sans"'); await document.fonts.ready; });
  expect(await page.evaluate(() => document.fonts.check('italic 600 30px "Hatch Sans"'))).toBe(true);
  const images = await page.locator('img').evaluateAll(images => images.filter(image => (image as HTMLImageElement).getAttribute('src')?.startsWith('/design/')).map(image => ({ src: (image as HTMLImageElement).src, loaded: (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0 })));
  for (const image of images) expect(image.loaded, image.src).toBe(true);
}

async function phoneWidths(page: import('@playwright/test').Page) {
  for (const width of [320,390,430]) {
    await page.setViewportSize({width,height:932});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `No horizontal scrolling at ${width}px`).toBe(true);
  }
}

test("Figma phone entry, About, capture and named ticket use local artwork and font files", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  let status: string | null = null;
  const ticket = () => ({ id: '2b2c4167-d1ea-4f9f-a720-698e90ca1d53',number:7,name:'Alex',ahead:1,status,createdAt:'2026-10-14T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z' });
  await page.route('**/api/participant/queue', route => route.fulfill({json:{waiting:1,capacity:20,accepting:true,online:true}}));
  await page.route('**/api/participant/queue/ticket', route => { if(route.request().method()==='POST')status='preparing'; return status ? route.fulfill({json:ticket()}) : route.fulfill({status:401,json:{error:'No ticket'}}); });
  await page.route('**/api/participant/queue/upload', route => {status='ready';return route.fulfill({json:ticket()});});
  await page.goto('/mobile'); await expect(page.getByRole('button',{name:'Upload drawing',exact:true})).toBeEnabled(); await fonts(page);
  const logo = await page.locator('.mobile-brand .brand-logo').boundingBox(); expect(logo?.width).toBeCloseTo(303,0); expect(logo?.y).toBeCloseTo(209,0);
  await page.screenshot({path:'test-results/design-mobile-landing.png',fullPage:true});
  await page.getByRole('button',{name:'About Out of Body',exact:true}).click(); await fonts(page);
  await expect(page.getByText('Out of Body revolves around an artistic release of the self.',{exact:false})).toBeVisible();
  await page.screenshot({path:'test-results/design-mobile-about.png',fullPage:true});
  await page.getByRole('button',{name:'Back to home',exact:true}).click(); await page.getByRole('button',{name:'Upload drawing',exact:true}).click(); await fonts(page);
  await phoneWidths(page);
  await page.screenshot({path:'test-results/design-mobile-capture.png',fullPage:true});
  const drawing=await sharp(Buffer.from(silhouetteSvg(true))).png().toBuffer();
  await page.getByTestId('mobile-photo').setInputFiles({name:'drawing.png',mimeType:'image/png',buffer:drawing});
  await page.getByLabel('Name').fill('Alex'); await fonts(page);
  await phoneWidths(page);
  await page.screenshot({path:'test-results/design-mobile-preview.png',fullPage:true});
  await page.getByRole('button',{name:'Send to installation',exact:true}).click(); await expect(page.getByTestId('queue-ticket')).toBeVisible(); await fonts(page);
  await page.screenshot({path:'test-results/design-mobile-ticket.png',fullPage:true});
  await phoneWidths(page);
});

test("Figma desktop proportions retain the live instructor, drawing and four compact controls", async ({ page }) => {
  await page.setViewportSize({width:1440,height:1024}); await page.goto('/test');
  const svg=silhouetteSvg(false).replace('</svg>','<rect x="280" y="110" width="40" height="30" fill="#e5b543"/></svg>');
  await page.getByTestId('art-upload').setInputFiles({name:'neck.png',mimeType:'image/png',buffer:await sharp(Buffer.from(svg)).png().toBuffer()});
  await page.getByText('Setup tools',{exact:true}).click(); await page.getByRole('combobox',{name:'Motion source',exact:true}).selectOption('manual');
  await page.getByRole('button',{name:'Start guided session',exact:true}).click(); await expect(page.getByTestId('stretch-exhibit')).toBeVisible(); await fonts(page);
  await expect(page.getByTestId('stretch-exhibit').getByRole('button')).toHaveCount(4);
  const guide=await page.locator('.exhibit-guide').boundingBox(); expect(guide?.x).toBeCloseTo(105,0); expect(guide?.width).toBeCloseTo(588.5,0);
  const body=await page.getByTestId('avatar').boundingBox(), pane=await page.locator('.participant-pane').boundingBox();
  expect(body!.y + body!.height * 806 / 900).toBeLessThan(pane!.y + pane!.height - 20);
  await page.screenshot({path:'test-results/design-stretching.png',fullPage:true});
  for(const width of [320,768,1024,1440]) {await page.setViewportSize({width,height:1024}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});
