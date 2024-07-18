import { type ListingTitle, ListingData } from "../src/getListingData";
import  {type Listing } from './groupListingData'
import fs from 'fs';

const jsonString = fs.readFileSync('./data/discsSorted.json', 'utf-8');
const discs = JSON.parse(jsonString);

export type ValidatedListingTitles = Map<number, {
    listing: string;
    detailsUrl: string;
}>

export default function validateListings(unfilteredListings: ListingTitle[], manufacturer: string, inventoryHref: string): ValidatedListingTitles {
    console.log('validating listings');
    
    const extractedData = new Map<number, { listing: string, detailsUrl: string }>();
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

        const listingModel = discs[manufacturer].find((info: any) => {
            const regex = new RegExp(`(^|\\s)${info.name.toLowerCase()}(\\s|$)`);
            return regex.test(cleanedListingLower)
        });

        if (listingModel) { 
            extractedData.set(listingData.listingIndex, {
                listing: cleanedListing,
                detailsUrl: url.href,
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


export function mostCommonPath(extractedData: Listing[]) {
    const urls = [...extractedData.values()].filter(l => l.price).map(l => l.detailsUrl).filter(l => l);

    const pathCounter = new Map<string, number>();

    urls.forEach(url => {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/').filter(segment => segment);

        for (let i = 1; i <= pathSegments.length; i++) {
            const path = pathSegments.slice(0, i).join('/');
            const pathCount = pathCounter.get(path);
            if (pathCount) {
                pathCounter.set(path, pathCount + 1);
            } else {
                pathCounter.set(path, 1);
            }
        }
    });

    console.log(pathCounter)

}