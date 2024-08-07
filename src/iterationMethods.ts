
import scrollToElement from "./scrollToElement";
import { 
    type Page, 
    ElementHandle 
} from 'puppeteer';
import validateListings, {
    type Listing
} from "../utils/validateListings";
import getPageListings, { type ListingTitle, ListingData, ListingImgs, ListingPrices } from "./getPageListings";
import isNewListings from "../utils/isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import generateResponse from '../utils/inference';
  
// Extract listings by clicking the next button
export async function paginationListings(page: Page, manufacturer: string, retailer: string): Promise<Listing[]> {
    // Keeps track of all the potential listings. This is important to keep track of as well as validated listings
    // Becasue we use this to decide when to stop paginating. We don't want to stop just because one page doesn't have any valid listings.
    const listingData: ListingData[] = []; 
    const validatedListings: Listing[] = [];
    const terminatingString = 'End of inventory';

    let pageNum = 1;
    let newListings;
    do {
        await waitForStaticPage(page);
	    console.log("Cur page:", page.url());
        const nextElem = await getNextElem(page, terminatingString, pageNum);

        if (!nextElem) {
            return validatedListings;
        }

        await scrollToElement(page, nextElem);
        
        const pageListings = await getPageListings(page);
        newListings = isNewListings(listingData.map(data => data.listings).flat(), pageListings?.listings)
        console.log('newListings?', newListings)

        if (pageListings) {
            listingData.push(pageListings);
            const listings = await validateListings(page, pageListings, manufacturer, retailer);

            if (listings.length) {
                validatedListings.push(...listings)   
            }
        }
        try {    
            await nextElem.evaluate((handle) => (handle as HTMLElement).click());
            console.log('clicked')
        } catch(e) {
            console.log('Error clicking element', e)
            return validatedListings;
        }
        pageNum++;
    } while (newListings);

    return validatedListings;
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
