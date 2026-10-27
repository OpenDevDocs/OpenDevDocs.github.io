// Sätteri (Astro 7's Markdown processor) HAST plugin: wraps every Markdown table in
// `<div class="table-scroll">` so a table wider than a phone screen scrolls on its
// own instead of pushing the whole page (or the lesson column) sideways.
// Styles live in src/styles/global.css.
import { defineHastPlugin } from 'satteri';

export function tableScroll() {
    return defineHastPlugin({
        name: 'table-scroll',
        element: {
            filter: ['table'],
            visit(node, ctx) {
                ctx.wrapNode(node, {
                    type: 'element',
                    tagName: 'div',
                    properties: { className: ['table-scroll'] },
                    children: [],
                });
            },
        },
    });
}
