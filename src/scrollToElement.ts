import puppeteer, { type Page, ElementHandle} from 'puppeteer'

export default async function scrollToElement(page: Page, element: ElementHandle): Promise<void> {
    await page.evaluate((element) => {

        if (!element) {
            window.scrollTo(0,0);
            return
        }

        const elementRect = element.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.scrollY;
        const middle = absoluteElementTop - (window.innerHeight / 2) + (elementRect.height / 2);
        window.scrollTo(0, middle);
    }, element);
}