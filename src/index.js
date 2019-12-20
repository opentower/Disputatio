var leaderline = require('leader-line')
var draggable = require('plain_draggable')

class GraphNode extends HTMLElement {
    constructor(parent,x,y, id) {
        super();
        this.graph = parent
        if (id) this.uuid = id
        else this.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.graph.nodes[this.uuid] = this //register in the graph
        this.edges = {} //initialize table of edges
        this.style.position = 'absolute'
        this.style.display= 'inline-block'
        this.style.outline = '1px solid gray'
        this.style.padding = '10px'
        this.addEventListener('mousemove', e => { 
            if (e.buttons != 0) this.redrawEdges()
            this.dragger.position()
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
            left: x, 
            top: y, 
            handle:bg,
            onMove: _ => this.redrawEdges(),
        });
    }

    clearEdges() { for (var key in this.edges) this.graph.removeEdge(this,this.graph.nodes[key]) }

    detach() {
        this.clearEdges()
        if (this.cluster) delete this.cluster.nodes[this.uuid]; //delete from nodes if in cluster
        delete this.graph.nodes[this.uuid] //delete from graph
        this.parentNode.removeChild(this); 
        if (this.graph.focalNode == this) this.graph.focalNode = null
    }

    attach(parent) { parent.appendChild(this); }

    redrawEdges() { 
        for (var key in this.edges) {
            this.edges[key].position()
        }
    }

    toJSON() { 
        return { 
            uuid: this.uuid,
            edges: Object.keys(this.edges),
            top: this.dragger.top,
            left: this.dragger.left,
            role: "none",
        }
    }

}

class AssertionNode extends GraphNode {

    constructor(parent,x,y,id) {
        super(parent,x,y,id)
        this.isAssertionNode = true
        this.input = document.createElement("textarea");
        this.input.style.position = 'relative'
        this.input.cols = 5
        this.input.rows = 1
        this.input.style.border = 'none'
        this.input.style.zIndex = 5;
        this.input.graphNode = this
        this.appendChild(this.input);
        this.input.addEventListener('focusout', _ => { if (this.input.value == "") this.detach() })
        this.input.addEventListener('keydown', e => { if (e.key == "Enter") {
        }})
        this.input.focus()
        this.dragger.onDragEnd = _ => { 
            for (var v of this.graph.contains(this)) {
                if (v.isClusterNode) {v.addNode(this); break}
            }
        }
    }

    toJSON() {
        let obj = super.toJSON()
        obj.role = "assertion"
        obj.value = this.input.value
        return obj
    }
}

class Graph extends HTMLElement {
    constructor() {
        super();
        this.focalNodeContent //initialize focal node content
        this.nodes = {}       //initialize table of nodes
        this.edges = {}       //initialize table of edges
        this.style.display = 'inline-block'
        this.style.outline = '1px solid'
        this.style.overflow = 'hidden'
        this.style.position = 'relative'
        this.addEventListener('click',e => { 
            if (e.target == this) { this.createNode(e.clientX,e.clientY) } 
            else if (this.focalNode && e.target.graphNode && e.shiftKey) { //holding shift makes the click manipulate arrows.
                let targetNode = e.target.graphNode
                if (targetNode.uuid in this.focalNode.edges) { //turn support into denial
                    if (this.focalNode.valence == "pro") {
                        this.focalNode.valence = "con"
                    } else { //or remove denial
                        this.removeEdge(this.focalNode,targetNode)
                        this.focalNode.valence = null
                    }
                } else if (e.target.graphNode.isAssertionNode) { //otherwise draw an arrow if the target is eligible
                    if (this.focalNode.isAssertionNode && targetNode != this.focalNode) {
                        this.focalNode = this.createCluster(this.focalNode)
                        this.createEdge(this.focalNode, targetNode)
                        this.focalNode.valence = "pro"
                    } else if (this.focalNode.isClusterNode && targetNode.cluster != this.focalNode ) {
                        this.focalNode.clearEdges()
                        this.createEdge(this.focalNode, targetNode)
                        this.focalNode.valence = "pro"
                    }
                }
            } else if (e.target.graphNode.parentNode == this) { //without shift, click updates focus
                this.focalNode = e.target.graphNode
            }
        })
    }

    clear() { for (var key in this.nodes) try {this.nodes[key].detach()} catch(e) {} }
    //we try/catch here because some parents may be removed before their children

    fromJSON(json) {
        let obj = JSON.parse(json)
        let rect = this.getBoundingClientRect()
        console.log(rect)
        //create assertions
        for (var key in obj.nodes) if (obj.nodes[key].role == "assertion") {
            let savednode = obj.nodes[key]
            new AssertionNode(this, savednode.left + rect.x, savednode.top + rect.y, savednode.uuid)
            this.nodes[key].input.value = savednode.value
        }
        // cluster them and add edges
         for (var key in obj.nodes) if (obj.nodes[key].role == "cluster") {
             let savednode = obj.nodes[key]
             let cluster = new GraphNodeCluster(this, savednode.left + rect.x, savednode.top + rect.y, savednode.uuid)
             for (var nodekey of savednode.nodes) cluster.addNode(this.nodes[nodekey])
             for (var nodekey of savednode.edges) this.createEdge(cluster, this.nodes[nodekey])
             cluster.valence = savednode.valence
         }
    }

    toJSON () { 
        return {
            nodes: this.nodes,
            focus: this.focalNode,
        }
    }
    set focalNode(n) { 
        if (this.focalNode) {
            this.focalNodeContents.style.outlineWidth = "1px"
            this.focalNodeContents.classList.remove('focalNode')
        }
        this.focalNodeContents = n
        if (this.focalNode) {
            this.focalNodeContents.style.outlineWidth = "2px"
            this.focalNodeContents.classList.add('focalNode')
        }
    }

    get focalNode() { return this.focalNodeContents }

    createNode(x,y) { 
        let node = new AssertionNode(this,x,y); 
        this.focalNode = node
        return node
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

    contains(node) {
        let containers = []
        for (var key in this.nodes) {
            let val = this.nodes[key]
            let rect1 = val.getBoundingClientRect()
            let rect2 = node.getBoundingClientRect()
            if ((rect1.x < rect2.x) && (rect1.x + rect1.width > rect2.x)
             && (rect1.y < rect2.y) && (rect1.y + rect1.height > rect2.y)
             ) containers.push(val)
        }
        return containers
    }

}

class GraphNodeCluster extends GraphNode {

    constructor(parent,x,y,id) {
        super(parent,x,y,id);

        this.nodes = {}
        this.isClusterNode = true
        this.valenceContent = null

        this.observer = new MutationObserver(t => {
            if (Object.keys(this.nodes).length == 0) this.detach() 
        })
        this.observer.observe(this, {subtree:true, childList: true})
        this.dragger.onMove = _ => {
            this.redrawEdges();
            for (var key in this.nodes) this.nodes[key].redrawEdges()
        }
        this.clusterContents = document.createElement("div");
        this.appendChild(this.clusterContents);
    }
    
    addNode(node) {
        this.clusterContents.appendChild(node)
        this.dragger.position();
        node.style.position = "relative"
        node.style.transform = "none"
        this.nodes[node.uuid] = node
        node.cluster = this
        node.dragger.onDragEnd = _ => { 
            if (this.graph.contains(node).includes(this)) {
                this.addNode(node) 
            } else {
                let unbroken = true
                for (var v of this.graph.contains(node)) {
                    if (v.isClusterNode) {
                        this.removeNode(node)
                        v.addNode(node)
                        this.graph.focalNode = v
                        unbroken = false
                        break
                    }
                }
                if (unbroken) { this.removeNode(node); this.graph.focalNode = node }
            }
        }
        this.graph.focalNode = this
        this.redrawEdges();
        node.redrawEdges();
    }

    removeNode(node) {
        node.style.position = "absolute"
        this.graph.appendChild(node) //reattach to graph
        node.dragger.position();
        node.dragger.top = this.dragger.top + node.dragger.top + 2 //reposition
        node.dragger.left = this.dragger.left + node.dragger.left + 2
        node.cluster = null
        delete this.nodes[node.uuid] //delete from node list
        node.dragger.onDragEnd = _ => { 
            for (var v of this.graph.contains(node)) { 
                if (v.isClusterNode) {v.addNode(node); break}
            }
        }
        this.redrawEdges();
        node.redrawEdges();
    }

    get valence() { return this.valenceContent }

    set valence(s) { 
        this.valenceContent = s 
        if (s == "pro") {
            this.style.outlineColor = "green"
            for (var key in this.edges) this.edges[key].color = "green"
        } else if (s == "con") {
            this.style.outlineColor = "red"
            for (var key in this.edges) this.edges[key].color = "red"
        } else {
            this.style.outlineColor = "gray"
        }
    }

    toJSON () {
        let obj = super.toJSON()
        obj.role = "cluster"
        obj.nodes = Object.keys(this.nodes)
        obj.valence = this.valence
        return obj
    }

}

customElements.define('wc-graph', Graph);
customElements.define('wc-graphnode', AssertionNode);
customElements.define('wc-graphnodecluster', GraphNodeCluster);
