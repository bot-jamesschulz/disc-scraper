import { type ListingTitle } from "../src/getPageData";
import  {type Listing } from './groupListingData';
import fs from 'fs';

const jsonString = fs.readFileSync('./data/discsSorted.json', 'utf-8');
const discs = JSON.parse(jsonString);
const manufacturersJsonString = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJsonString).map((m: string) => m.toLowerCase());

export type Disc = {
    listing: string;
    detailsUrl: string;
    model: string,
    manufacturer: string
}

export type ValidatedListingTitles = Map<number, Disc>

export default function validateListings(unfilteredListings: ListingTitle[], manufacturer: string, inventoryHref: string): ValidatedListingTitles {
    console.log('validating listings');
    
    const extractedData = new Map<number, Disc>();
    const rejectedListings: string[] = [];

    for (const listingData of unfilteredListings) {
        
        const url = makeUrl(listingData?.href || '', inventoryHref);

        if (!url)  continue;   
        
        let listing = listingData?.innerText 

        let cleanedListing = listing
            .replace(/[^\w\.\/\s\u2013\u2014\u2212-]/g, '') // Remove any abnormal characters
            .replace(/\s+/g, ' ')                           // Replace consecutive spaces with a single space
            .trim();                                        // Trim leading and trailing spaces
        
        const noLetters = !cleanedListing.match(/[a-zA-Z]/);
        
        if (noLetters) continue;

        const cleanedListingLower = cleanedListing.toLowerCase();

        // Other manufacturers cannot be present in listing. This is to prevent same model names being selected for the wrong manufacturer.
        if (manufacturers.some((m: string) => cleanedListingLower.includes(m) && m !== manufacturer.toLowerCase())) continue;

        const listingModel = discs[manufacturer].find((info: any) => {
            const regex = new RegExp(`(^|\\s)${info.name.toLowerCase()}(\\s|$)`);
            return regex.test(cleanedListingLower)
        });

        if (listingModel) { 
            extractedData.set(listingData.listingIndex, {
                listing: cleanedListing,
                detailsUrl: url.href,
                model: listingModel,
                manufacturer
            })
        } else {
            rejectedListings.push(cleanedListing);
        }
    }

    return extractedData;
}

function makeUrl(listingHref: string, inventoryHref: string) {
    try {
        return new URL(listingHref, inventoryHref);
    } catch(err) {
        console.log('error creating url from: ', listingHref)
    }
}