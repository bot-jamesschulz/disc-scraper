export default function getInputSelector(input: string): string | undefined {
    if (input.includes('id')) {
        return '#' + input.match(/id="([^"]+)"/)?.[1]
    } else if (input.includes('class')) {
        return '.' + input.match(/class="([^"]+)"/)?.[1]
    }
}