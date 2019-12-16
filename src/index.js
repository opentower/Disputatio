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
        this.dragger = new PlainDraggable(this, {
            left:x, 
            top:y, 
            handle:bg,
            onMove: _ => this.redrawEdges(),
        });
        this.generateContent()
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
        this.dragger.onDragEnd = _ => { this.graph.onContained(this, v => {
                if (v.isClusterNode) {v.addNode(this); return true}
                else return false
        })}
    }

    clearEdges() { for (var key in this.edges) this.graph.removeEdge(this,this.graph.nodes[key]) }

    detach() {
        this.clearEdges()
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
        this.focalNodeContent //initialize focal node content
        this.nodes = {} //initialize table of nodes
        this.style.display = 'inline-block'
        this.style.outline = '1px solid'
        this.style.overflow = 'hidden'
        this.style.position = 'relative'
        this.addEventListener('click',e => { 
            if (e.target == this) { this.createNode(e.clientX,e.clientY) } 
            else if (e.target.graphNode && e.shiftKey) { //holding shift makes the click manipulate arrows.
                let targetNode = e.target.graphNode
                if (targetNode.uuid in this.focalNode.edges) { //turn support into denial
                    if (this.focalNode.edges[targetNode.uuid].valence == "pro") {
                        this.focalNode.edges[targetNode.uuid].valence = "con"
                        this.focalNode.edges[targetNode.uuid].color = "red"
                        this.focalNode.style.outlineColor = "red"
                    } else { //or remove denial
                        this.removeEdge(this.focalNode,targetNode)
                        this.focalNode.style.outlineColor = "gray"
                    }
                } else if (e.target.graphNode.isGraphNode) { //otherwise draw an arrow if the target is eligible
                    if (this.focalNode.isGraphNode && targetNode != this.focalNode) {
                        this.focalNode = this.createCluster(this.focalNode)
                        this.createEdge(this.focalNode, targetNode)
                        this.focalNode.style.outlineColor = "green"
                        this.focalNode.edges[targetNode.uuid].valence = "pro"
                    } else if (this.focalNode.isClusterNode && targetNode.cluster != this.focalNode ) {
                        this.focalNode.clearEdges()
                        this.createEdge(this.focalNode, targetNode)
                        this.focalNode.edges[targetNode.uuid].valence = "pro"
                        this.focalNode.style.outlineColor = "green"
                    }
                }
            } else if (e.target.graphNode.parentNode == this) { //without shift, click updates focus
                this.focalNode = e.target.graphNode
            }
        })
    }

    set focalNode(n) { 
        if (this.focalNode) {
            this.focalNodeContents.style.outlineWidth = "1px"
            this.focalNodeContents.classList.remove('focalNode')
        }
        this.focalNodeContents = n
        this.focalNodeContents.style.outlineWidth = "2px"
        this.focalNodeContents.classList.add('focalNode')
    }

    get focalNode() { return this.focalNodeContents }

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
        let line = new LeaderLine(n1, n2, {color:"green"})
        n1.edges[n2.uuid] = line
        n2.edges[n1.uuid] = line
    }

    removeEdge(n1,n2) {
        n1.edges[n2.uuid].remove()
        delete n1.edges[n2.uuid]
        delete n2.edges[n1.uuid]
    }

    onContained(node,cb) {
        for (var key in this.nodes) {
            let val = this.nodes[key]
            let rect1 = val.getBoundingClientRect()
            let rect2 = node.getBoundingClientRect()
            if ((rect1.x < rect2.x) && (rect1.x + rect1.width > rect2.x)
             && (rect1.y < rect2.y) && (rect1.y + rect1.height > rect2.y)
             ) { if (cb(val)) break; }
        }
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
        node.dragger.top = 0
        node.dragger.left = 0
        node.dragger.onDragEnd = _ => { 
            if (node.dragger.left < this.getBoundingClientRect().width 
             && node.dragger.top < this.getBoundingClientRect().height) {
                this.addNode(node) 
            } else {
                this.removeNode(node)
                this.graph.focalNode = node
            }
        }
        this.graph.focalNode = this
        this.redrawEdges();
        node.redrawEdges();
    }

    removeNode(node) {
        node.dragger.top = this.dragger.top + node.dragger.top + 2 //reposition
        node.dragger.left = this.dragger.left + node.dragger.left + 2
        node.style.position = "absolute"
        this.graph.appendChild(node) //reattach to graph
        node.cluster = null
        delete this.nodes[node.uuid] //delete from node list
        node.dragger.onDragEnd = _ => { 
            node.graph.onContained(node, v => {
                if (v.isClusterNode) {v.addNode(node); return true}
                else return false
            })
        }
        this.redrawEdges();
        node.redrawEdges();
    }

}

customElements.define('wc-graph', Graph);
customElements.define('wc-graphnode', GraphNode);
customElements.define('wc-graphnodecluster', GraphNodeCluster);
