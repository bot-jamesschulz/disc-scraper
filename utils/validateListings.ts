import { 
    type ListingTitle,
    type ListingImg,
    type ListingPrice,
    type ListingData,
    type Position
} from "../src/getPageListings";
import fs from 'fs';
import { Page } from 'puppeteer';

const jsonString = fs.readFileSync('./data/discsSorted.json', 'utf-8');
const discs = JSON.parse(jsonString);
const manufacturersJsonString = fs.readFileSync('./data/majorManufacturers.json', 'utf-8');
const manufacturers = JSON.parse(manufacturersJsonString).map((m: string) => m.toLowerCase());

export type PartialListing = {
    listing: string,
    details_url: string,
    original_href: string,
    position: Position,
    model: string,
    type: string,
    manufacturer: string,
    retailer: string
}

export type Listing = {
    listing: string,
    details_url: string,
    img_src: string,
    price: number,
    model: string,
    type: string,
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
    const listingImgs = unfilteredListings.listingImgs;
    const listingPrices = unfilteredListings.listingPrices;
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

        const listingModels: { name: string, type: string }[] = discs[manufacturer].filter((info: any) => {
            const regex = new RegExp(`(^|\\s)${info.name.toLowerCase()}(\\s|$)`);
            return regex.test(cleanedListingLower);
        }).map((m: Model) => ({ name: m.name, type: m.primary_use }));

        // Find the longest matching listing so we get the most complete possible mold name
        const listingModel = listingModels.reduce((longest, current) => {
            return current.name.length > longest.name.length ? current : longest;
        }, listingModels[0]);

        if (listingModel) { 
            partialListings.push({
                listing,
                details_url: url.href,
                position: listingData.position,
                original_href: listingData.href,
                model: listingModel.name,
                type: listingModel.type,
                manufacturer,
                retailer
            })
        } else {
            rejectedListings.push(listing);
        }
    }

    const validatedListings = extractInfo(partialListings, listingImgs, listingPrices)
    
    return validatedListings;
}

function makeUrl(listingHref: string, retailerHref: string) {
    try {
        return new URL(listingHref, retailerHref);
    } catch(err) {
        console.log('error creating url from: ', listingHref)
    }
}

function extractInfo(partialListings: PartialListing[], listingImgs: ListingImg[], listingPrices: ListingPrice[]) {
    const listings: Listing[] = [];
    const seenImgs = new Set();
    const seenPrices = new Set();

    for (const l of partialListings) {
        const img = findClosest(l.position, listingImgs);
        const price = findClosest(l.position, listingPrices);

        console.log('listing', l.details_url);
        console.log('listing position', l.position)
        console.log('closestPrice', price);
        console.log('closestImg', img);
        
        if (!img || !price) continue;
        if (seenImgs.has(img.position)) img.src = '';
        if (seenPrices.has(price.position)) continue;

        seenPrices.add(price.position);
        seenImgs.add(img.position);

        listings.push({
            listing: l.listing,
            details_url: l.details_url,
            img_src: img.src,
            price: Number(price.price),
            model: l.model,
            type: l.type,
            manufacturer: l.manufacturer,
            retailer: l.retailer
        })
    }

    return listings;
}

function findClosest<T extends { position: Position }>(listingPosition: Position, listingInfo: T[]) {
    let closestInfo: T | null = null;
    let smallestDistance = Infinity;

    for (const info of listingInfo) {
        // Image has to be above the listing. this to prevent icon images being falsely selected
        if (isListingImg(info)) {
            if (listingPosition.y < info.topCoord) {
                // console.log('Img above listing', listingPosition, info, info.position)
                continue;
            }
        }
        const distance = Math.sqrt(
            Math.pow(info.position.x - listingPosition.x, 2) +
            Math.pow(info.position.y - listingPosition.y, 2)
        );

        if (distance < smallestDistance) {
            smallestDistance = distance;
            closestInfo = info;
        }
    }

    return closestInfo;
}

function isListingImg(info: any): info is ListingImg {
    return (info as ListingImg).topCoord !== undefined;
  }