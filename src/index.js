var leaderline = require('leader-line')
var draggable = require('plain_draggable')

class Graph extends HTMLElement {
    constructor() {
        super();
        this.style.display = 'inline-block'
        this.style.outline = '1px solid'
        this.style.overflow = 'hidden'
        this.style.position = 'relative'
        this.addEventListener('click',e => 
            {   if (e.target == this) {
                this.createNode(e.clientX,e.clientY)
                }
            }
        )
    }

    createNode(x,y) {
        let elt = document.createElement("div");
        let bg = document.createElement("div");
        let input = document.createElement("textarea");
        elt.style.position = 'absolute'
        elt.style.display= 'inline-block'
        elt.style.outline = '1px solid gray'
        elt.style.padding = '10px'
        bg.style.display = 'inline-block'
        bg.style.position = 'absolute'
        input.style.position = 'relative'
        input.style.border = 'none'
        input.style.margin = '0px'
        input.style.padding = '0px'
        bg.style.left = 0
        bg.style.height = '100%'
        bg.style.width = '100%'
        input.style.zIndex = 5;
        this.appendChild(elt);
        elt.appendChild(input);
        elt.appendChild(bg);
        new PlainDraggable(elt, {left:x, top:y, handle:bg});
        input.focus()
    }
}

customElements.define('wc-graph', Graph);
