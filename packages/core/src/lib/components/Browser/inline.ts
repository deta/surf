import type { PageHighlight } from './types'

export const inlineTextReplaceCode = (target: string, content: string) => `
(function() {
    const searchText = \`${target}\`;
    const transformation = \`${content}\`;

    function highlightSentence(sentence) {
      // save the current scroll position
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      try {
        // disable scrolling: if any scroll is attempted, set this to the previous value
        window.onscroll = function () {
            window.scrollTo(scrollLeft, scrollTop);
        };
    
        // Use window.find to find the sentence in the page
        const selection = window.getSelection();
        // Get the range of the found sentence
        const range = selection.getRangeAt(0);

        // Create a new mark element
        const mark = document.createElement('mark');
        mark.classList.add('highlight-transformation');

        // Create a new text node with the contents of the range
        const textNode = document.createTextNode(transformation);

        // Replace the range's contents with the new text node
        range.deleteContents();
        range.insertNode(textNode);

        // Wrap the found sentence in the mark element
        range.surroundContents(mark);

        window.getSelection().removeAllRanges()
        const div = document.getElementById('horizonTextDragHandle')
        if (div) {
          div.parentNode.removeChild(div)
        }
      } catch (e) {
        console.error('Error highlighting sentence', e)
      } finally {
        // re-enable scrolling
        window.onscroll = null;
        window.scrollTo(scrollLeft, scrollTop);
      }
    }
    
    highlightSentence(searchText);
})();
`

export const inlineTextReplaceStylingCode = () => `
(function() {
    try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
        window.trustedTypes.createPolicy('default', {
            createHTML: (string, sink) => string
        });
        }
    } catch (err) {}
    const style = document.createElement('style');
    style.innerHTML = 'mark.highlight-transformation { background-color: #ff47be24 !important; transition: background 0.2s ease; } mark.highlight-transformation:hover { background: #ff47be80 !important; }';
    document.head.appendChild(style);
})();
`

export const inlineHighlightStylingCode = () => `
(function() {
    const style = document.createElement('style');
    style.innerHTML = 'mark.highlight { background-color: #ffde3e38 !important; transition: background 0.2s ease; } mark.highlight:hover { background: #ffde3e7d !important; } mark.highlight-quote { background-color: #3ec8ff21 !important; } mark.highlight-quote:hover { background: #3ec8ff6b !important; } mark.highlight-pro { background-color: #3eff3e21 !important; } mark.highlight-pro:hover { background: #3eff3e6b !important; } mark.highlight-contra { background-color: #ff3e3e21 !important; } mark.highlight-contra:hover { background: #ff3e3e6b !important; } mark.highlight-statistic { background-color: #3e4bff21 !important; } mark.highlight-statistic:hover { background: #3e4bff52 !important;';
    document.head.appendChild(style);
})();
`

export const inlineHighlightTextCode = (highlight: PageHighlight) => `
(function() {
    const searchText = \`${highlight.text}\`;

    function highlightSentence(sentence) {
      // save the current scroll position
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      // Save the current selection
      const originalSelection = window.getSelection().rangeCount > 0 ? window.getSelection().getRangeAt(0) : null;

      try {
        // Create a range spanning the entire document
        const range = document.createRange();
        range.selectNodeContents(document.body);
    
        // Move the selection point to the start of the document
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        selection.collapseToStart();
 
        // disable scrolling: if any scroll is attempted, set this to the previous value
        window.onscroll = function () {
            window.scrollTo(scrollLeft, scrollTop);
        };
    
        // Use window.find to find the sentence in the page
        if (window.find(sentence)) {
            // Get the range of the found sentence
            const range = selection.getRangeAt(0);
    
            // Create a new mark element
            const mark = document.createElement('mark');
            mark.classList.add('highlight');
            mark.classList.add('highlight-${highlight.type}');
            mark.style.setProperty("background-color", "${highlight.color ?? ''}", "important")

            try {
                // Wrap the found sentence in the mark element
                range.surroundContents(mark);
            } catch (err) {
                console.warn(err)
        
                // Create a new text node with the contents of the range
                const textNode = document.createTextNode(range.toString());
        
                // Replace the range's contents with the new text node
                range.deleteContents();
                range.insertNode(textNode);
        
                // Wrap the found sentence in the mark element
                range.surroundContents(mark);
            }
    
            // Restore the original selection
            if (originalSelection) {
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(originalSelection);
            } else {
                window.getSelection().removeAllRanges()
            }
        } else {
            console.log(\`Sentence "\${sentence}" not found in the page.\`);
        }
      } catch (e) {
        console.error('Error highlighting sentence', e)
      } finally {
        // re-enable scrolling
        window.onscroll = null;
        window.scrollTo(scrollLeft, scrollTop);
      }
    }
    
    highlightSentence(searchText);
})();
      `

export const scrollToTextCode = (text: string) => `
(function() {
    const searchText = \`${text}\`;

    function scrollTo(sentence) {
      const originalSelection = window.getSelection().rangeCount > 0 ? window.getSelection().getRangeAt(0) : null;

      try {
        // Create a range spanning the entire document
        const range = document.createRange();
        range.selectNodeContents(document.body);
    
        // Move the selection point to the start of the document
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        selection.collapseToStart();

        window.find(sentence)

        if (originalSelection) {
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(originalSelection);
        } else {
            window.getSelection().removeAllRanges()
        }
      } catch (e) {
        console.error('Error scrolling to text', e)
      }
    }
    
    scrollTo(searchText);
})();
`
