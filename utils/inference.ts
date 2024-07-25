import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import delay from './delay';
import { encode } from 'gpt-tokenizer';

if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing or empty. Exiting.")
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const delayTime = 5000;
let tokenCount = 0;
let requestCount = 0;

export default async function generateResponse(prompt: string, maxTries = 3) {
    let tries = 0;
    
    
    while (tries < maxTries) {
        const currTokens = encode(prompt).length;
        tokenCount += currTokens;
        requestCount++;
        console.log('request count', requestCount);
        console.log('curr tokens: ', currTokens);
        console.log('total tokens: ', tokenCount);
        console.log('Prompt', prompt)
        let response;
        try {
            response = await model.generateContent(prompt);
            return response.response.text().trim();
        } catch(e) {
            console.log(e);
        }
        await delay(delayTime);
        tries++;
    }

    throw new Error('Max retry attempts reached for Gemini');
}