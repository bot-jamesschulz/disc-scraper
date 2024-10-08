
import scrollToElement from "./scrollToElement";
import { 
    type Page, 
    ElementHandle 
} from 'puppeteer';
import validateListings, {
    type Listing
} from "../utils/validateListings";
import getPageListings, { type ListingData } from "./getPageListings";
import isNewListings from "../utils/isNewListings";
import waitForStaticPage from "./waitForStaticPage";
import generateResponse from '../utils/inference';
import navigateTo from "./navigateTo";

export type PageQueryParam = { 
    key: string | null, 
    checked: boolean 
}
  
// Extract listings by infinite scroll
export async function infiniteScrollListings(
    page: Page, 
    manufacturer: string, 
    retailer: string
): Promise<{ 
    listings: Listing[], 
    isInfiniteScroll: boolean 
}> {
    // Keeps track of all the potential listings. This is important to keep track of as well as validated listings.
    // Becasue we use this to decide when to stop paginating. We don't want to stop just because one page doesn't have any valid listings.
    const listingData: ListingData[] = [];
    const validatedListings: Listing[] = [];
    let newListingData;
    let scrollIterations = 0;

    // Get infinite loaded listings
    do {
        console.log('Infite scroll iteration: ', scrollIterations);
        scrollIterations++;
        const pageListings = await getPageListings(page);

        if (pageListings) {
            listingData.push(pageListings);
        }
        
        await waitForStaticPage(page);

        newListingData = await getPageListings(page);
    } while (isNewListings(listingData.map(data => data.listings).flat(), newListingData?.listings));
    
    // Only the last page is passed since each "page" has all the listings of the previous pages as well
    const listings = await validateListings(page, listingData[listingData.length - 1], manufacturer, retailer);


    if (listings.length) {
        validatedListings.push(...listings)   
    }
    
    // If there was infinite scroll then skip checking for pagination
    if (scrollIterations > 1) {
        console.log('Infinite scroll listings. Pagination not attempted');
        return { 
            listings: validatedListings, 
            isInfiniteScroll: true 
        };
    } else

    return { 
        listings: validatedListings, 
        isInfiniteScroll: scrollIterations > 1 ? true : false 
    }
}

// Extract listings by iterating through the pages
export async function paginationListings(
    page: Page,
    manufacturer: string,
    retailer: string,
    pageQueryParam: PageQueryParam
): Promise<{ 
    listings: Listing[], pageQueryParam: PageQueryParam
}> {
    // Keeps track of all the potential listings. This is important to keep track of as well as validated listings
    // Becasue we use this to decide when to stop paginating. We don't want to stop just because one page doesn't have any valid listings.
    const listingData: ListingData[] = []; 
    const validatedListings: Listing[] = [];
    const terminatingString = 'End of inventory';

    let pageNum = 1;
    let newListings;
    do {
	    console.log("Cur page:", page.url());
        
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
            
            // Once/if we have the key for the query param that sets the page, use that..
            if (pageQueryParam.key) {
                console.log('page query param:', pageQueryParam.key);

                const url = new URL(page.url());
                url.searchParams.set(pageQueryParam.key, (pageNum + 1).toString())

                await navigateTo(url.toString(), page);
                
            
            // Default to finding the next element
            } else {
                const nextElem = await getNextElem(page, terminatingString, pageNum);

                if (!nextElem) {
                    return { listings: validatedListings, pageQueryParam };
                }
    
                await scrollToElement(page, nextElem);
                await nextElem.evaluate((handle) => (handle as HTMLElement).click());
                console.log('clicked');
                await waitForStaticPage(page);

                const pageListings = await getPageListings(page);
                newListings = isNewListings(listingData.map(data => data.listings).flat(), pageListings?.listings)

                // Only look for the queryParam once
                if (newListings && !pageQueryParam.checked) {
                    pageQueryParam = await getPageQueryParam(page);
                }
            }

        } catch(e) {
            console.log('Error navigating to next page', e)
            return { listings: validatedListings, pageQueryParam };
        }
        pageNum++;
    } while (newListings);

    return { listings: validatedListings, pageQueryParam };
}

async function getNextElem(
    page: Page, 
    terminatingString: string, 
    pageNum: number
): Promise<ElementHandle | null> {
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

async function getPageQueryParam(page: Page): Promise<PageQueryParam> {
    const url = page.url();
    const urlParams = new URLSearchParams(url);
    const result = await generateResponse(`Identify if there is a query param being used to set the page number. Do not create a key that doesn't already exist. Return only the param key if it is present in the url and no other information. If there is no key present used to set the page, return 'None': ${urlParams}`);
    console.log('result', result);

    // Verify Gemini isn't hallucinating
    const hasParam = urlParams.has(result);
    return hasParam ? { key: result, checked: true } : { key: null, checked: true };
}


