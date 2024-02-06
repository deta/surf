import { writable } from 'svelte/store'
import type { Horizon } from '../components'
import imageDND from '../../../public/assets/demo/dnd-full-hq.gif';
import imageOverview from '../../../public/assets/demo/overview-demo-full.gif';

export const initDemoHorizon = async (horizon : Horizon) => {
    console.log("CREATING DEMO CARDS")
    horizon.addCard({
        ...{x: 50, y: 50, width: 400, height: 300},
        type: 'text',
        data: {
            content: {"type":"doc","content":[{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Welcome to your new horizon! 🚀"}]},{"type":"paragraph","content":[{"type":"text","text":"Welcome aboard! We're thrilled to have you as one of the first to experience our new spatial browser. This project is close to our hearts, and your early insights are going to be a big part of its success. "}]},{"type":"paragraph","content":[{"type":"text","text":"Dive in, explore freely, and let us know what you think. Your feedback is not just valued – it's essential. Happy browsing!"}]},{"type":"paragraph"}]}
        }
    },true)


    horizon.addCard({
        ...{x: 50, y: 400, width: 400, height: 400},
        type: 'text',
        data: {
            content: {"type":"doc","content":[{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"How to use your Horizon"}]},{"type":"paragraph","content":[{"type":"text","text":"With this version you can essentially do browse the web for the first time! Here's a quick guide to get you started."}]},{"type":"paragraph"},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"Note-Taking"},{"type":"text","text":" Need to jot down thoughts? Simply draw on the screen to create a note."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":"New Browser Window"},{"type":"text","text":" Simply hold "},{"type":"text","marks":[{"type":"code"}],"text":"CMD (macOS)"},{"type":"text","text":" "},{"type":"text","marks":[{"type":"code"}],"text":"Ctrl (Windows)"},{"type":"text","text":" while drawing. This will create a new spatial browser."}]}]}]}]}
        }
    },true)

    horizon.addCardBrowser("https://en.wikipedia.org/wiki/Pea", {
        x: 550,
        y: 50,
        width: 600,
        height: 800
      }, true)


    horizon.addCard({
        ...{x: 1200, y: 50, width: 300, height: 220},
        type: 'text',
        data: {
            content: {"type":"doc","content":[{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Demo Zone: Drag stuff from the web."}]},{"type":"paragraph","content":[{"type":"text","text":"Ever wanted to just save an image or a text for later? Try it out by dragging images or text onto your horizon directly."}]},{"type":"paragraph"}]}
        }
    },true)

    // Set Card for drag and drop demo
    try {
        const response = await fetch(imageDND);
        const imageBlob = await response.blob();

        await horizon.addCardFile(imageBlob, {
            x: 1200,
            y: 280,
            width: 400,
            height: 250
        });
    } catch (error) {
        console.error('Error in initDemoHorizon:', error);
    }


    horizon.addCard({
        ...{x: 1800, y: 50, width: 300, height: 220},
        type: 'text',
        data: {
            content: {"type":"doc","content":[{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Lets see your Horizons"}]},{"type":"paragraph","content":[{"type":"text","text":"By pressing "},{"type":"text","marks":[{"type":"code"}],"text":"CMD"},{"type":"text","text":" / "},{"type":"text","marks":[{"type":"code"}],"text":"Ctrl"},{"type":"text","text":" + "},{"type":"text","marks":[{"type":"code"}],"text":"K"},{"type":"text","text":" or pinching with your trackpad, you get into the horizon overview, from where you can select, create and delete your horizons."}]}]}
        }
    },true)

    // Set Card for overview
    try {
        const response = await fetch(imageOverview);
        const imageBlob = await response.blob();

        await horizon.addCardFile(imageBlob, {
            x: 1800,
            y: 300,
            width: 600,
            height: 500
        });
    } catch (error) {
        console.error('Error in initDemoHorizon:', error);
    }


    horizon.addCard({
        ...{x: 2700, y: 300, width: 300, height: 400},
        type: 'text',
        data: {
            content: {"type":"doc","content":[{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Want to have another Horizon?"}]},{"type":"paragraph","content":[{"type":"text","text":"Simply create a new Horizon by"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Pressing "},{"type":"text","marks":[{"type":"code"}],"text":"CMD"},{"type":"text","text":" / "},{"type":"text","marks":[{"type":"code"}],"text":"Ctrl"},{"type":"text","text":" + "},{"type":"text","marks":[{"type":"code"}],"text":"N"}]}]}]},{"type":"paragraph"},{"type":"paragraph","content":[{"type":"text","text":"You also can create a new Horizon with a new Browser by:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Pressing "},{"type":"text","marks":[{"type":"code"}],"text":"CMD"},{"type":"text","text":" / "},{"type":"text","marks":[{"type":"code"}],"text":"Ctrl"},{"type":"text","text":" + "},{"type":"text","marks":[{"type":"code"}],"text":"T"}]}]}]}]}
        }
    },true)

    



}



    