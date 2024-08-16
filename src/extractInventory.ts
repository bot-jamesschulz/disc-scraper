import { 
  type ListingPrice
} from "./getPageListings";
import { 
  infiniteScrollListings,
  paginationListings
} from "./iterationMethods";
import {
  type ValidatedListings,
  type Listing
} from "../utils/validateListings";
import { type Page } from 'puppeteer';

export type ValidatedListingsPage = {
  listings: ValidatedListings,
  prices: ListingPrice[],
  imgs: string[]
}

export default async function extractInventory(page: Page, manufacturer: string, retailer: string, pageQueryParam: string | undefined): Promise<{
  listings: Listing[],
  pageQueryParam: string | undefined
}> {

  try {
    const { listings: validatedInfiniteScrollListings, isInfiniteScroll } = await infiniteScrollListings(page, manufacturer, retailer);
    
    if (isInfiniteScroll) {
      return { listings: validatedInfiniteScrollListings, pageQueryParam };
    }
    
  } catch(e) {
    console.log('Error extracting infinite scroll listings', e);
  }

  try {
    return await paginationListings(page, manufacturer, retailer, pageQueryParam);
  } catch(e) {
    console.log('Error extracting paginated listings', e);
  }

  return { listings: [], pageQueryParam };
}