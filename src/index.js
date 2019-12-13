var leaderline = require('leader-line')
var draggable = require('plain_draggable')


class GraphNode extends HTMLElement {
    constructor(parent,x,y) {
        super();
        this.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.edges = {} //initialize table of edges
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
        input.addEventListener('focusout', _ => { if (input.value == "") this.detach() })
        // The below isn't maximally efficient, but it does handle resize well.
        this.addEventListener('mousemove', e => { 
            if (e.buttons != 0) this.redrawEdges()
        }) 
        this.attach(parent)
        new PlainDraggable(this, {
            left:x, 
            top:y, 
            handle:bg,
        });
        input.focus()
    }
    detach() { this.parentNode.removeChild(this); }

    attach(parent) { parent.appendChild(this); }

    redrawEdges() { 
        for (var key in this.edges) {
            this.edges[key].position()
            console.log(this.edges)
        }
    }
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
                } else if (e.target.graphNode && e.shiftKey && e.target.graphNode.uuid in this.focalNode.edges) {
                    this.removeEdge(this.focalNode,e.target.graphNode)
                } else if (e.target.graphNode && e.shiftKey) {
                    this.createEdge(this.focalNode,e.target.graphNode)
                } else if (e.target.graphNode) {
                    this.focalNode = e.target.graphNode
                }
            }
        )
    }

    createNode(x,y) { new GraphNode(this,x,y); }

    createEdge(n1,n2) {
        let line = new LeaderLine(n1, n2)
        n1.edges[n2.uuid] = line
        n2.edges[n1.uuid] = line
    }

    removeEdge(n1,n2) {
        n1.edges[n2.uuid].remove()
        delete n1.edges[n2.uuid]
        delete n2.edges[n1.uuid]
    }
}

customElements.define('wc-graph', Graph);
customElements.define('wc-graphnode', GraphNode);
