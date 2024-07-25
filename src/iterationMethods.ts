
import scrollToElement from "./scrollToElement";
import { type Page, ElementHandle } from 'puppeteer';
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getPageData";
import isNewListings from "../utils/isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import generateResponse from '../utils/inference';
  
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
    const navigationOptionsHtml = [...navigationOptions.keys()];

    const result = await generateResponse(`Identify which element is most likely to be the navigation element to the next page of inventory, given that we are on page ${pageNum} currently, and return the entire element. Do not return any other text or information, and do not wrap the returned value in backticks. If there is no next page navigation element return "${terminatingString}".  ${navigationOptionsHtml}`);
    console.log('result', result);

    // Signal that the end of inventory has been reached
    if (result === terminatingString) {
        return null;
    }
    const nextElem = navigationOptions.get(result) || null;

    return nextElem;
}