var leaderline = require('leader-line')
var draggable = require('plain_draggable')


class GraphNode extends HTMLElement {
    constructor(parent,x,y) {
        super();
        this.edges = [] //initialize array of edges
        let bg = document.createElement("div");
        let input = document.createElement("textarea");
        this.style.position = 'absolute'
        this.style.display= 'inline-block'
        this.style.outline = '1px solid gray'
        this.style.padding = '10px'
        input.style.position = 'relative'
        input.cols = 5
        input.rows = 1
        input.style.border = 'none'
        input.graphNode = this
        bg.style.display = 'inline-block'
        bg.style.position = 'absolute'
        bg.style.background = 'white'
        bg.style.top = 0
        bg.style.left = 0
        bg.style.height = '100%'
        bg.style.width = '100%'
        bg.graphNode = this
        input.style.zIndex = 5;
        this.appendChild(input);
        this.appendChild(bg);

        this.observer = new MutationObserver(_ => this.redrawEdges)
        this.observer.observe(input, {attributes: true})
        input.addEventListener('focusout', _ => { if (input.value == "") this.detach() })
        this.attach(parent)
        new PlainDraggable(this, {
            left:x, 
            top:y, 
            handle:bg,
            onMove: _ => this.redrawEdges()
        });
        input.focus()
    }
    detach() { this.parentNode.removeChild(this); }

    attach(parent) { parent.appendChild(this); }

    redrawEdges() { this.edges.forEach(l => l.position()) }
}

class Graph extends HTMLElement {
    constructor() {
        super();

        this.focalNode //initialize focal node
        this.style.display = 'inline-block'
        this.style.outline = '1px solid'
        this.style.overflow = 'hidden'
        this.style.position = 'relative'
        this.addEventListener('click',e => 
            {   if (e.target == this) {
                this.createNode(e.clientX,e.clientY)
                } else if (e.target.graphNode && e.shiftKey) {
                    let line = new LeaderLine(this.focalNode, e.target.graphNode)
                    this.focalNode.edges.push(line)
                    e.target.graphNode.edges.push(line)
                } else if (e.target.graphNode) {
                    this.focalNode = e.target.graphNode
                }
            }
        )
    }

    createNode(x,y) { new GraphNode(this,x,y); }
}

customElements.define('wc-graph', Graph);
customElements.define('wc-graphnode', GraphNode);
