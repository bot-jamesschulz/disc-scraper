import { type Page, ElementHandle } from 'puppeteer';
import scrollToElement from './scrollToElement';
import "dotenv/config";
import waitForStaticPage from './waitForStaticPage';
import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing or empty. Exiting.");
}

let prompt = "Identify which element is most likely to be a search input for the website's inventory, and return it. Do not return anything else.";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


export default async function searchInventory(page: Page, manufacturer: string) {
    
    const inputHandles = await page.$$("input");
    const inputProspects = new Map<string, ElementHandle<HTMLInputElement>>();
    for (const handle of inputHandles) {
        const outer = await page.evaluate(el => el.outerHTML.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), handle) // Clean extra space and returns from element html
        inputProspects.set(`${outer}`, handle);
    };

    prompt = `${prompt} ${[...inputProspects.keys()]}`

    let response = await model.generateContent(prompt);
    const result = response.response.text().trim();

    console.log('input element', result)

    const inputElement = inputProspects.get(result) || null;

    // Exit if there is no selector found
    if (!inputElement) {
        throw new Error('No input element found');
    }

    await scrollToElement(page, inputElement);

    console.log('is hidden', await inputElement.isHidden())

    // await inputElement.type(manufacturer);

    await page.evaluate(async (input, query) => {
    if (input) {
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

        await new Promise(resolve => setTimeout(resolve, 100));
        }

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
        input.dispatchEvent(enterEvent);
        input.dispatchEvent(keyDownEvent);
        input.dispatchEvent(keyPressEvent);
        input.dispatchEvent(inputEvent);
        input.dispatchEvent(keyUpEvent);
        
        // input.value = query;
        console.log('input value', input.value);

        await new Promise(resolve => setTimeout(resolve, 500)); // Somehow this prevents a execution context error
        input.closest('form')?.submit();
    }
    }, inputElement, manufacturer);

    await waitForStaticPage(page);
}