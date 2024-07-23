import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import scrollToElement from "./scrollToElement";
import { type Page, ElementHandle } from 'puppeteer';
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getListingData";
import isNewListings from "../utils/isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import fs from 'fs';
import { encode } from 'gpt-tokenizer';

if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing or empty. Exiting.")
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
let tokenCount = 0;
  
// Extract listings by clicking the next button
export async function paginationListings(page: Page): Promise<ListingData[]> {
    const listingData: ListingData[] = [];
    const terminatingString = 'End of inventory';

    let pageNum = 1;
    let newListings;
    do {
        await waitForStaticPage(page);
        const nextElem = await getNextElem(page, terminatingString, pageNum);

        if (!nextElem) {
            return listingData;
        }

        await scrollToElement(page, nextElem);
        

        const pageListings = await getPageListings(page);
        newListings = isNewListings(listingData.map(data => data.listings).flat(), pageListings?.listings)
        console.log('newListings?', newListings)

        if (pageListings) {
            listingData.push(pageListings);
        }
        
        try {
            
            await nextElem.evaluate((handle) => (handle as HTMLElement).click());
            console.log('clicked')
        } catch(e) {
            console.log('Error clicking element', e)
            return listingData;
        }
        pageNum++;
    } while (newListings);

    // Convert the processed data back to JSON
   const newData = JSON.stringify(listingData.map(data => data.listings).flat(), null, 2);
    
   // Write the processed data to discs.json
   fs.writeFile('./results/listingData.json', newData, () => {});

    return listingData;
}

async function getNextElem(page: Page, terminatingString: string, pageNum: number): Promise<ElementHandle | null> {
    // Get pagination loaded listings
    const buttonAndAnchorHandles = await page.$$('button, a');
    
    const navigationOptions = new Map<string, ElementHandle>();
    for (const handle of buttonAndAnchorHandles) {
        const outer = await page.evaluate(el => el.outerHTML.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), handle) // Clean extra space and returns from element html
        if (outer.toLowerCase().includes('next') 
            || outer.toLowerCase().includes('more results')
            || outer.toLowerCase().includes('load more')
            || outer.toLowerCase().includes('paginat')
            || outer.toLowerCase().includes('page=')
            ) {
            navigationOptions.set(`${outer}`, handle);
        };
    };
    const navigationOptionsHtml = [...navigationOptions.keys()]
    const currTokens = navigationOptionsHtml.reduce((accumulator, currentValue) => accumulator + encode(currentValue).length, 0)
    tokenCount += currTokens
    console.log('curr tokens: ', currTokens);
    console.log('total tokens: ', tokenCount);
    console.log('keys');
    [...navigationOptions.keys()].forEach(el => console.log(el));
    const response = await model.generateContent(`Identify which element is most likely to be the navigation element to the next page of inventory, given that we are on page ${pageNum} currently, and return it. Do not return any other text or information, and do not wrap the returned value in backticks. If there is no next page navigation element return "${terminatingString}".  ${navigationOptionsHtml}`);
    const result = response.response.text().trim();

    console.log('result', result);

    // Signal that the end of inventory has been reached
    if (result === terminatingString) {
        return null;
    }
    const nextElem = navigationOptions.get(result) || null;

    return nextElem;
}