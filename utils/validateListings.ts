import { type ListingTitle } from "../src/getPageData";
import fs from 'fs';
import { type Listing } from '../utils/groupListingData';

const jsonString = fs.readFileSync('./data/discsSorted.json', 'utf-8');
const discs = JSON.parse(jsonString);
const manufacturersJsonString = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJsonString).map((m: string) => m.toLowerCase());

export type Disc = {
    listing: string;
    details_url: string;
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

export type ValidatedListingTitles = Map<number, Disc>

export default function validateListings(unfilteredListings: ListingTitle[], manufacturer: string, retailerHref: string, uniqueListings: Set<string>): { validatedListings: ValidatedListingTitles, uniqueListings: Set<string> } {
    console.log('validating listings');
    
    const extractedData = new Map<number, Disc>();
    const rejectedListings: string[] = [];

    for (const listingData of unfilteredListings) {
        
        const url = makeUrl(listingData.href || '', retailerHref);

        if (!url || uniqueListings.has(url.href)) continue;   
        uniqueListings.add(url.href);

        const retailer = new URL(retailerHref).hostname;
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

        const listingModels: string[] = discs[manufacturer].filter((info: any) => {
            const regex = new RegExp(`(^|\\s)${info.name.toLowerCase()}(\\s|$)`);
            return regex.test(cleanedListingLower);
        }).map((m: Model) => m.name);

        console.log('Models', listingModels);

        const listingModel = listingModels.reduce((longest, current) => {
            return current.length > longest.length ? current : longest;
        }, "");

        console.log('Model', listingModel);

        if (listingModel) { 
            extractedData.set(listingData.listingIndex, {
                listing: cleanedListing,
                details_url: url.href,
                model: listingModel,
                manufacturer,
                retailer
            })
        } else {
            rejectedListings.push(cleanedListing);
        }
    }

    return { validatedListings: extractedData, uniqueListings };
}

function makeUrl(listingHref: string, retailerHref: string) {
    try {
        return new URL(listingHref, retailerHref);
    } catch(err) {
        console.log('error creating url from: ', listingHref)
    }
}