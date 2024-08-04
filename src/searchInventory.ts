import { type Page, ElementHandle } from 'puppeteer';
import scrollToElement from './scrollToElement';
import generateResponse from '../utils/inference';
import "dotenv/config";
import waitForStaticPage from './waitForStaticPage';

export default async function searchInventory(page: Page, manufacturer: string) {
    let prompt = "Identify which element is most likely to be a search input for the website's inventory, and return that exact element with no changes. Do not return anything else.";

    const inputHandles = await page.$$("input");
    const inputProspects = new Map<string, ElementHandle<HTMLInputElement>>();
    for (const handle of inputHandles) {
        const outer = await page.evaluate(el => el.outerHTML.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), handle) // Clean extra space and returns from element html
        inputProspects.set(`${outer}`, handle);
    };

    prompt = `${prompt} ${[...inputProspects.keys()]}`

    let result = await generateResponse(prompt);

    console.log('input element', result)

    const inputElement = inputProspects.get(result) || null;

    // Exit if there is no selector found
    if (!inputElement) {
        throw new Error('No input element found');
    }

    await scrollToElement(page, inputElement);

    console.log('is hidden', await inputElement.isHidden())

    const url = page.url();
    
    await page.evaluate(async (input, query) => {
        input.removeAttribute('disabled');
        input.style.visibility = 'visible';
        let i = 0;
        for (const char of query) {
            const keyDownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true });
            const keyPressEvent = new KeyboardEvent('keypress', { key: char, bubbles: true });
            const inputEvent = new Event('input', { bubbles: true });
            const keyUpEvent = new KeyboardEvent('keyup', { key: char, bubbles: true });

            input.value += char;
            input.dispatchEvent(keyDownEvent);
            input.dispatchEvent(keyPressEvent);
            input.dispatchEvent(inputEvent);
            input.dispatchEvent(keyUpEvent);

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        await new Promise(resolve => setTimeout(resolve, 500)); // Somehow this prevents a execution context error

	const enterEvent = new KeyboardEvent('keydown', {
        	key: 'Enter',
        	code: 'Enter',
        	keyCode: 13,
        	which: 13,
        	bubbles: true
        });
        const keyDownEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        const keyPressEvent = new KeyboardEvent('keypress', { key: 'Enter', bubbles: true });
        const inputEvent = new Event('input', { bubbles: true });
        const keyUpEvent = new KeyboardEvent('keyup', { key: 'Enter', bubbles: true });
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        input.dispatchEvent(enterEvent);
        input.dispatchEvent(keyDownEvent);
        input.dispatchEvent(keyPressEvent);
        input.dispatchEvent(inputEvent);
        input.dispatchEvent(keyUpEvent);
        input.dispatchEvent(changeEvent);
        
        

    }, inputElement, manufacturer);
    
    await waitForStaticPage(page);
    let newUrl = page.url();
    console.log('url after browser handling', newUrl);

    if (url === newUrl) {
        try {
            await inputElement.evaluate(el => el.value = "");
            await inputElement.type(manufacturer);
            await inputElement.evaluate((el, brand) => el.value = brand, manufacturer);
    
            inputElement.press('Enter');
        } catch{}
    }

    await waitForStaticPage(page);
    newUrl = page.url();
    console.log('url after puppeteer handling', newUrl);

    if (url === newUrl) {
        await page.evaluate((input) => {
            input.closest('form')?.submit();
        }, inputElement);
    }

    await waitForStaticPage(page);
    console.log('url after form submission', newUrl);
}
