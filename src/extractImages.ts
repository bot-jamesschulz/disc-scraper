import { type Page } from 'puppeteer';

export type ImgPosition = 'before' | 'after';
export type ImgAssociation = { 
    src: string
    associatedListing: string 
};

export default async function extractImages(page: Page, listingHrefs: string[]): Promise<ImgAssociation[]> {
    console.log('extracting images');
    let imgs: ImgAssociation[] = [];
    try {
        imgs = await page.evaluate(async (hrefs) => {
            let curImgWait = 0;
            const maxImgWait = 5000;
            const imgs: ImgAssociation[] = [];
            const anchors = Array.from(document.querySelectorAll('a')); 

            // const hrefSet = new Set();
            // hrefs.slice(0,5).forEach(h => console.log('111 Looking for this href:', h));
            
            // anchors.forEach(a => {
            //     if (hrefSet.has(a.href)) return;
            //     console.log('111 href', a.href);
            //     hrefSet.add(a.href);
            // });
            // Select all the elements inside of the listing anchors
            const anchorElements = hrefs.map(href => {
                const anchor = anchors.find(a => a.href.includes(href));
                return { 
                    href,
                    elements: Array.from(anchor?.querySelectorAll('*') || []) 
                }
            })

            // Look for elements that contain images
            for (const { href, elements } of anchorElements) {
                if (!elements) {
                    console.log('No anchor for: ', href);
                    continue;
                }

                // Filter just image containing elements
                const imgElements: Element[] = elements.filter((element: Element) => (
                    element.tagName === "IMG" 
                    || (element.tagName === "INPUT" 
                        && (element.hasAttribute("src") || element.hasAttribute("srcset"))
                        )
                    )
                );

                for (const element of imgElements) {
                        
                    const waitInterval = 100; // Time to wait before checking the src attribute again
                    const maxWaitTime = 500; // Maximum wait time for checking src
                    let elapsedTime = 0;
                    let waitCount = 0;
            
                    // Wait for src attribute to be set
                    const waitForSrc = async () => {
                        
                        // Get first url of scrset
                        if (element.getAttribute("srcset")) {
                            const url = element.getAttribute("srcset");
                            const endOfUrl = url?.indexOf(" ");
                            const firstUrl = endOfUrl !== -1 ? url?.substring(0, endOfUrl) : url;
                            if (firstUrl) imgs.push({ 
                                src: firstUrl,
                                associatedListing: href 
                            });
                            return;
                        }

                        if (element.getAttribute("src")) {
                            let url;
                            try {
                            const src = element.getAttribute("src");
                            if (src) {
                                url = new URL(src, window.location.href);
                            }
                            } catch (err) {}
            
                            if (url?.href.startsWith("http")) {
                                imgs.push({ 
                                    src: url.href, 
                                    associatedListing: href }
                                );
                                return;
                            }
                        }
                        
                        elapsedTime += waitInterval;
                        curImgWait += waitInterval;
                        ++waitCount;
                        if (
                            elapsedTime < maxWaitTime
                            && curImgWait < maxImgWait
                        ) {
                            console.log('waiting')
                            await new Promise((resolve) => setTimeout(resolve, waitInterval));
                            await waitForSrc();
                        }
                    };
                    await waitForSrc();     
                }
            }
            return imgs;
        }, listingHrefs);
    } catch(e) {
        console.log('Error extracting images');
    }
    return imgs;
}