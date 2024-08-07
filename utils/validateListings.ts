import { 
    type ListingTitle,
    type ListingData
} from "../src/getPageListings";
import fs from 'fs';
import extractImages from "../src/extractImages";
import extractPrices from "../src/extractPrices";
import { Page } from 'puppeteer';

const jsonString = fs.readFileSync('./data/discsSorted.json', 'utf-8');
const discs = JSON.parse(jsonString);
const manufacturersJsonString = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJsonString).map((m: string) => m.toLowerCase());

export type PartialListing = {
    listing: string,
    listing_index: number,
    details_url: string,
    original_href: string,
    model: string,
    manufacturer: string,
    retailer: string
}

export type Listing = {
    listing: string,
    details_url: string,
    img_src: string,
    price: number,
    model: string,
    manufacturer: string,
    retailer: string
}

type Model = {
    id: number,
    name: string,
    speed: number,
    glide: number,
    turn: number,
    fade: number,
    primary_use: string,
    stability: string,
    bead: string,
    border: string,
    rim_diameter_ratio: number,
    rim_configuration: string,
    height: number,
    rim_depth: number,
    rim_thickness: number,
    inside_rim_diameter: number,
    diameter: number,
    show: number
}

export type ValidatedListings = Map<number, PartialListing>;

export default async function validateListings(page: Page, unfilteredListings: ListingData, manufacturer: string, retailerHref: string): Promise<Listing[]> {
    console.log('validating listings');
    
    const unfilteredListingsTitles: ListingTitle[] = unfilteredListings.listings;
    const partialListings: PartialListing[] = [];
    const rejectedListings: string[] = [];

    for (const listingData of unfilteredListingsTitles) {
        
        const url = makeUrl(listingData.href || '', retailerHref);

        if (!url) continue;   

        const retailer = new URL(retailerHref).hostname;
        let listing = listingData?.innerText 

        const noLetters = !listing.match(/[a-zA-Z]/);
        
        if (noLetters) continue;

        const cleanedListingLower = listing.toLowerCase();

        // Other manufacturers cannot be present in listing. This is to prevent same model names being selected for the wrong manufacturer.
        if (manufacturers.some((m: string) => cleanedListingLower.includes(m) && m !== manufacturer.toLowerCase())) continue;

        const listingModels: string[] = discs[manufacturer].filter((info: any) => {
            const regex = new RegExp(`(^|\\s)${info.name.toLowerCase()}(\\s|$)`);
            return regex.test(cleanedListingLower);
        }).map((m: Model) => m.name);

        const listingModel = listingModels.reduce((longest, current) => {
            return current.length > longest.length ? current : longest;
        }, "");

        if (listingModel) { 
            partialListings.push({
                listing,
                listing_index: listingData.listingIndex,
                details_url: url.href,
                original_href: listingData.href,
                model: listingModel,
                manufacturer,
                retailer
            })
        } else {
            rejectedListings.push(listing);
        }
    }
    
    const images = await extractImages(page, partialListings.map(l => l.original_href));
    const prices = extractPrices(partialListings.map(l => ({ listingPosition: l.listing_index, listing: l.original_href })), unfilteredListings.listingPrices);
    console.log('extracted images', images);
    console.log('extracted prices', prices);

    const listings: Listing[] = [];

    // Assemble listings
    partialListings.forEach(l => {
        const img = images.find(i => i.associatedListing === l.original_href);
        const price = prices.find(p => p.associatedListing === l.original_href);

        if (img && price) {
            listings.push({
                listing: l.listing,
                details_url: l.details_url,
                img_src: img.src,
                price: price.price,
                model: l.model,
                manufacturer: l.manufacturer,
                retailer: l.retailer
            })
        }
    })

    return listings;
}

function makeUrl(listingHref: string, retailerHref: string) {
    try {
        return new URL(listingHref, retailerHref);
    } catch(err) {
        console.log('error creating url from: ', listingHref)
    }
}