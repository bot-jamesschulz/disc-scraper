export default function getSelector(input: string): string | null {
    if (input.includes('id=')) {
        return '#' + input.match(/id="([^"]+)"/)?.[1]
    } else if (input.includes('class=')) {
        return '.' + input.match(/class="([^"]+)"/)?.[1].replace(/\s+/g, '.');
    }

    return null;
}