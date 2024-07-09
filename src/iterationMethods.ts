import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { element2selector } from 'puppeteer-element2selector';
import puppeteer from "puppeteer-extra";
import { type Page } from 'puppeteer';
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getListingData";
import scrollPage from "./scrollPage";
import isNewListings from "./isNewListings";
import waitForStaticPage from "./waitForStaticPage";

if (!process.env.GEMINI_API_KEY) {
    console.error("Gemini API key is missing or empty. Exiting.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
// Extract listings by clicking the next button
export async function paginationListings(page: Page): Promise<ListingData[]> {
    const listingData: ListingData[] = [];
    const terminatingString = 'End of inventory';
    

    let newListingData: ListingData | undefined;
    do {
        const nextElemSelector = await getNextElemSelector(page, terminatingString);
        if (nextElemSelector === terminatingString) {
            return listingData;
        }
        const pageListings = await getPageListings(page);

        console.log('Prices', pageListings?.listingPrices.filter(l => l))

        if (pageListings) {
            listingData.push(pageListings);
        }
        const nextElem = await page.$(nextElemSelector);
        try {
            await nextElem?.click();
        } catch(e) {
            console.log('Error clicking element', e)
            return listingData;
        }
        
        await waitForStaticPage(page);

        newListingData = await getPageListings(page);
    } while (isNewListings(listingData.map(data => data.listings).flat(), newListingData?.listings));

    return listingData;
}

async function getNextElemSelector(page: Page, terminatingString: string): Promise<string> {
    // Get pagination loaded listings
    const buttonAndAnchorHandles = await page.$$('button, a');
    const navigationProspects = new Map<string, string>();
    for (const handle of buttonAndAnchorHandles) {

        const outer = await page.evaluate(el => el.outerHTML.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), handle) // Clean extra space and returns from element html
        const selector = await element2selector(handle); // Element handle to css selector

        if (!selector) {
            continue;
        };

        if (outer.toLowerCase().includes('next') || outer.toLowerCase().includes('more results')) {
            navigationProspects.set(`${outer}`, selector);
        };
    };

    console.log('keys', `|${[...navigationProspects.keys()]}|`);

    const response = await model.generateContent(`Identify which element is most likely to be the navigation element to the next page of inventory. Do not return any other text or information. If there is no next page navigation element return "${terminatingString}".  ${[...navigationProspects.keys()]}`);
    const result = response.response.text().trim();

    console.log('result', result);

    // Signal that the end of inventory has been reached
    if (result === terminatingString) {
        return terminatingString
    }

    const nextElemSelector = navigationProspects.get(result);

    if (!nextElemSelector) {
        throw new Error(`No selector found in map for ${result}`);
    };

    return nextElemSelector;
}