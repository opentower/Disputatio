var leaderline = require('leader-line')
var draggable = require('plain_draggable')

class GraphNode extends HTMLElement {
    constructor(parent,x,y) {
        super();
        this.graph = parent
        this.isGraphNode = true
        this.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.graph.nodes[this.uuid] = this //register in the graph
        this.edges = {} //initialize table of edges
        this.style.position = 'absolute'
        this.style.display= 'inline-block'
        this.style.outline = '1px solid gray'
        this.style.padding = '10px'
        this.addEventListener('mousemove', e => { 
            if (e.buttons != 0) this.redrawEdges()
        }) 

        let bg = document.createElement("div");
        bg.style.display = 'inline-block'
        bg.style.position = 'absolute'
        bg.style.background = 'white'
        bg.style.top = 0
        bg.style.left = 0
        bg.style.height = '100%'
        bg.style.width = '100%'
        bg.graphNode = this

        this.appendChild(bg);
        // The below isn't maximally efficient, but it does handle resize well.
        this.attach(parent)
        this.generateContent()
        this.dragger = new PlainDraggable(this, {
            left:x, 
            top:y, 
            handle:bg,
            onMove: _ => this.redrawEdges(),
        });
    }

    generateContent() {
        let input = document.createElement("textarea");
        input.style.position = 'relative'
        input.cols = 5
        input.rows = 1
        input.style.border = 'none'
        input.style.zIndex = 5;
        input.graphNode = this
        this.appendChild(input);
        input.addEventListener('focusout', _ => { if (input.value == "") this.detach() })
        input.addEventListener('keydown', e => { if (e.key == "Enter") {
        }})
        input.focus()
    }

    detach() {
        for (var key in this.edges) {
            this.graph.removeEdge(this,this.graph.nodes[key])
        }
        if (this.cluster) delete this.cluster.nodes[this.uuid]; //delete from nodes if in cluster
        delete this.graph.nodes[this.uuid] //delete from graph
        this.parentNode.removeChild(this); 
    }

    attach(parent) { 
        parent.appendChild(this); 
    }

    redrawEdges() { 
        for (var key in this.edges) {
            this.edges[key].position()
        }
    }
}

class Graph extends HTMLElement {
    constructor() {
        super();

        this.nodes = {} //initialize table of nodes
        this.focalNode //initialize focal node
        this.style.display = 'inline-block'
        this.style.outline = '1px solid'
        this.style.overflow = 'hidden'
        this.style.position = 'relative'
        this.addEventListener('click',e => { 
            if (e.target == this) { this.createNode(e.clientX,e.clientY) } 
            else if (e.target.graphNode && e.shiftKey) {
                let targetNode = e.target.graphNode
                //holding shift makes the click manipulate arrows.
                if (targetNode.uuid in this.focalNode.edges) {
                    //remove an arrow if it's already there
                    this.removeEdge(this.focalNode,targetNode)
                } else if (e.target.graphNode.isGraphNode) {
                    //otherwise draw an arrow if the target is eligible
                    if (this.focalNode.isGraphNode && targetNode != this.focalNode) {
                        this.focalNode = this.createCluster(this.focalNode)
                        this.createEdge(this.focalNode, e.target.graphNode)
                    } else if (this.focalNode.isClusterNode && targetNode.cluster != this.focalNode ) {
                        this.createEdge(this.focalNode, e.target.graphNode)
                    }
                }
            } else if (e.target.graphNode.parentNode == this) {
                //without shift, click updates focus
                this.focalNode = e.target.graphNode
            }
        })
    }

    createNode(x,y) { 
        let node = new GraphNode(this,x,y); 
        this.focalNode = node
    }

    createCluster(node) {
        let cluster = new GraphNodeCluster(this,node.dragger.left,node.dragger.top); 
        cluster.addNode(node)
        return cluster
    }

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

class GraphNodeCluster extends GraphNode {
    constructor(parent,x,y) {
        super(parent,x,y);
        this.nodes = {}
        this.isGraphNode = false
        this.isClusterNode = true

        this.observer = new MutationObserver(t => {
            if (Object.keys(this.nodes).length == 0) this.detach() 
        })
        this.observer.observe(this, {subtree:true, childList: true})
        this.dragger.onMove = _ => {
            this.redrawEdges();
            for (var key in this.nodes) this.nodes[key].redrawEdges()
        }
    }
    
    generateContent() {
        this.array = document.createElement("div");
        this.appendChild(this.array);
    }

    addNode(node) {
        this.array.appendChild(node)
        node.style.position = "relative"
        node.style.transform = "none"
        this.nodes[node.uuid] = node
        node.cluster = this
        node.dragger.remove()
    }

}

customElements.define('wc-graph', Graph);
customElements.define('wc-graphnode', GraphNode);
customElements.define('wc-graphnodecluster', GraphNodeCluster);
