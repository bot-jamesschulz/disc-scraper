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

export default async function extractInventory(page: Page, manufacturer: string, retailer: string): Promise<Listing[]> {

  try {
    const { listings: validatedInfiniteScrollListings, isInfiniteScroll } = await infiniteScrollListings(page, manufacturer, retailer);
    
    if (isInfiniteScroll) {
      return validatedInfiniteScrollListings;
    }
    
  } catch(e) {
    console.log('Error extracting infinite scroll listings', e);
  }


  try {
    return await paginationListings(page, manufacturer, retailer);
  } catch(e) {
    console.log('Error extracting paginated listings', e);
  }

  return [];
}