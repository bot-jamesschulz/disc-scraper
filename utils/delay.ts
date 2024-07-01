export default async function delay(length: number) {
    await new Promise(resolve => setTimeout(resolve, length));
}