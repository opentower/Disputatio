var leaderline = require('leader-line')
var draggable = require('plain_draggable')

class GraphNode extends HTMLElement {
    constructor(parent,x,y, config) {
        super();
        this.graph = parent
        if (!config) config = {}
        if (config.uuid) this.uuid = config.uuid
        else this.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.graph.nodes[this.uuid] = this //register in the graph
        this.incoming = {} //initialize table of incoming edges
        this.outgoing = {} //initialize table of outgoing edges
        this.style.position = 'absolute'
        this.style.display= 'inline-block'
        this.style.outline = '1px solid gray'
        this.style.padding = '10px'
        this.addEventListener('mousemove', e => { 
            if (e.buttons != 0) this.graph.redrawEdges()
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
            onMove: _ => this.graph.redrawEdges(),
            onDragEnd: _ => this.graph.historyUpdate(),
        });
    }

    clearOutgoing() { for (var key in this.outgoing) this.graph.removeEdge(this,this.graph.nodes[key]) }

    clearIncoming() { for (var key in this.incoming) this.graph.removeEdge(this.graph.nodes[key],this) }

    detach() {
        this.clearOutgoing()
        this.clearIncoming()
        if (this.cluster) delete this.cluster.nodes[this.uuid]; //delete from nodes if in cluster
        delete this.graph.nodes[this.uuid] //delete from graph
        if (this.parentNode) this.parentNode.removeChild(this); //remove if parent exists
        if (this.graph.focalNode == this) this.graph.focalNode = null
    }

    attach(parent) { parent.appendChild(this); }

    toJSON() { 
        let rect = this.graph.getBoundingClientRect()
        return { 
            config: {
                uuid: this.uuid,
            },
            incoming: Object.keys(this.incoming),
            outgoing: Object.keys(this.outgoing),
            //need to correct for position of graph
            relativetop: this.dragger.top - rect.y,
            relativeleft: this.dragger.left - rect.x,
            role: "none",
        }
    }

}

class AssertionNode extends GraphNode {

    constructor(parent,x,y,config) {
        super(parent,x,y,config)
        if (!config) config = {}
        this.isAssertionNode = true
        this.inputTimeout = false
        this.input = document.createElement("textarea");
        this.input.style.position = 'relative'
        this.input.cols = 5
        this.input.rows = 1
        this.input.style.border = 'none'
        this.input.style.zIndex = 5;
        this.input.graphNode = this
        if (config.value) {
            this.input.value = config.value
            this.input.cols = Math.min(15,config.value.length)
            this.input.rows = Math.floor(config.value.length / 15)
        }
        if (config.immutable) {
            this.addEventListener('keydown', e => {
                if (e.key == "Backspace") 
                this.detach()
                e.preventDefault() 
            })
        } else {
            this.input.addEventListener('input', e => {
                clearTimeout(this.inputTimeout)
                this.inputTimeout = setTimeout(_ => this.graph.historyUpdate(),250) 
            })
        }
        this.appendChild(this.input);
        this.input.addEventListener('focusout', _ => { if (this.input.value == "") this.detach() })
        this.input.focus()
        this.dragger.onDragEnd = _ => { 
            for (var v of this.graph.contains(this)) {
                if (v.isClusterNode) {v.addNode(this); break}
            }
            this.graph.historyUpdate()
        }
    }

    toJSON() {
        let obj = super.toJSON()
        obj.role = "assertion"
        obj.config.value = this.input.value
        obj.config.immutable = this.input.disabled
        return obj
    }
}

class Graph extends HTMLElement {
    constructor() {
        super();
        this.focalNodeContent = null //initialize focal node content
        this.nodes = {}              //initialize table of nodes
        this.edges = {}              //initialize table of edges
        this.history = []
        this.future = []
        this.present = JSON.stringify(this)
        this.historyLock = false
        this.style.display = 'inline-block'
        this.style.outline = '1px solid'
        this.style.overflow = 'hidden'
        this.style.position = 'relative'
        this.addEventListener('dragover', e => {e.preventDefault()})
        this.addEventListener('drop', e => {
            e.preventDefault(); 
            let data = e.dataTransfer.getData("application/disputatio")
            this.createNode(e.clientX,e.clientY,{value: data, immutable: true})
        })
        this.addEventListener('click',e => { 
            if (e.target == this) { this.createNode(e.clientX,e.clientY) } 
            else if (this.focalNode && e.target.graphNode && e.shiftKey) { //holding shift makes the click manipulate arrows.
                let targetNode = e.target.graphNode
                if (targetNode.uuid in this.focalNode.outgoing) { //turn support into denial
                    if (this.focalNode.valence == "pro") {
                        this.focalNode.valence = "con"
                    } else { //or remove denial
                        this.removeEdge(this.focalNode,targetNode)
                        this.focalNode.valence = null
                    }
                } else if (targetNode != this.focalNode) { //otherwise draw an arrow if the target is eligible
                    if (this.focalNode.isAssertionNode) {
                        this.focalNode = this.createCluster(this.focalNode)
                        this.createEdge(this.focalNode, targetNode)
                        this.focalNode.valence = "pro"
                    } else if (this.focalNode.isClusterNode && targetNode.cluster != this.focalNode ) {
                        this.focalNode.clearOutgoing()
                        this.createEdge(this.focalNode, targetNode)
                        this.focalNode.valence = "pro"
                    }
                } 
                this.focalNode.updateIncoming()
            } else if (e.target.graphNode.parentNode == this) { //without shift, click updates focus
                this.focalNode = e.target.graphNode
            }
        })
    }

    historyUpdate() {
        setTimeout(_ => {
            if (!this.historyLock) {
                let present = JSON.stringify(this)
                let change = this.present != present
                if (change) { 
                    this.history.push(this.present) 
                    this.present = present
                    console.log('updated')
                }
                this.future = [] //reset future
                this.historyLock = true //lock history until timeout fires
            }
            clearTimeout(this.historyTimeout)
            this.historyTimeout = setTimeout(_ => this.historyLock = false, 250)
        }, 50) //timeout here to make sure updates are finished
    }

    undo() { 
        this.historyLock = true
        this.clear()
        if (this.history.length > 0) {
            let past = this.history.pop()
            this.future.push(this.present)
            this.present = past
            this.fromJSON(past)
        } else { console.log("no history") }
    }

    redo() { 
        this.historyLock = true
        if (this.future.length > 0) {
            this.clear()
            let future = this.future.pop()
            this.history.push(this.present)
            this.present = future
            this.fromJSON(future)
        } else { console.log("no future") }
    }

    clear() { 
        for (var key in this.edges) this.edges[key].remove()
        while (this.firstChild) this.removeChild(this.firstChild)
        this.edges = {}
        this.nodes = {}
    }

    redrawEdges() { for (var key in this.edges) this.edges[key].position() }

    fromJSON(json) {
        let obj = JSON.parse(json)
        let rect = this.getBoundingClientRect()
        //create assertions
        for (var key in obj.nodes) if (obj.nodes[key].role == "assertion") {
            let savednode = obj.nodes[key]
            new AssertionNode(this, savednode.relativeleft + rect.x, savednode.relativetop + rect.y, savednode.config)
        }
        // cluster them
        for (var key in obj.nodes) if (obj.nodes[key].role == "cluster") {
            let savednode = obj.nodes[key]
            let cluster = new GraphNodeCluster(this, savednode.relativeleft + rect.x, savednode.relativetop + rect.y, savednode.config)
            for (var nodekey of savednode.nodes) cluster.addNode(this.nodes[nodekey])
        }
        //add edges
        for (var key in obj.nodes) if (obj.nodes[key].role == "cluster") {
            let savednode = obj.nodes[key]
            let cluster = this.nodes[savednode.config.uuid]
            for (var nodekey of savednode.outgoing) this.createEdge(cluster, this.nodes[nodekey])
            cluster.valence = savednode.valence
        }
        //refocus
        if (obj.focus) this.focalNode = this.nodes[obj.focus.config.uuid]
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

    createNode(x,y,config) { 
        let node = new AssertionNode(this,x,y,config); 
        this.focalNode = node
        this.historyUpdate()
        return node
    }

    createCluster(node) {
        let cluster = new GraphNodeCluster(this,node.dragger.left,node.dragger.top); 
        cluster.addNode(node)
        this.historyUpdate()
        return cluster
    }

    createEdge(n1,n2) {
        var line
        if (n2.isClusterNode && n2.uniqueOutgoing) {
            let euuid = n2.uniqueOutgoing.uuid
            let etext = document.getElementById(euuid).querySelector("text")
            line = new LeaderLine(n1, etext, {color:"green"})
        } else { 
            line = new LeaderLine(n1, n2, {color:"green"})
        }
        line.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.edges[line.uuid] = line
        line.middleLabel = LeaderLine.captionLabel("⠀") 
        //XXX:this is an empty braile symbol, rather than a space, since the
        //label cannot be just whitespace
        n1.outgoing[n2.uuid] = line
        n2.incoming[n1.uuid] = line
        let svg = document.querySelector("body > *.leader-line:last-child")
        svg.id = line.uuid
        this.historyUpdate()
    }

    removeEdge(n1,n2) {
        if (n1 && n2) {
            let line = n1.outgoing[n2.uuid]
            delete this.edges[line.uuid]
            delete n1.outgoing[n2.uuid]
            delete n2.incoming[n1.uuid]
            line.remove()
        }
        this.historyUpdate()
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

    constructor(parent,x,y,config) {
        super(parent,x,y,config);
        if (!config) config = {}
        this.nodes = {}
        this.isClusterNode = true
        this.valenceContent = null

        this.observer = new MutationObserver(t => {
            if (Object.keys(this.nodes).length == 0) this.detach() 
        })
        this.observer.observe(this, {subtree:true, childList: true})
        this.dragger.onMove = _ => { this.graph.redrawEdges(); }
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
            this.graph.historyUpdate()
        }
        this.graph.focalNode = this
        this.graph.redrawEdges();
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
            this.graph.historyUpdate()
        }
        this.graph.redrawEdges();
    }

    get uniqueOutgoing() {
        let outgoingKey = Object.keys(this.outgoing)[0]
        if (outgoingKey) { return this.outgoing[outgoingKey] }
        else { return null }
    }

    get valence() { return this.valenceContent }

    set valence(s) { 
        this.valenceContent = s 
        if (s == "pro") {
            this.style.outlineColor = "green"
            for (var key in this.outgoing) this.outgoing[key].color = "green"
        } else if (s == "con") {
            this.style.outlineColor = "red"
            for (var key in this.outgoing) this.outgoing[key].color = "red"
        } else {
            this.style.outlineColor = "gray"
        }
        this.graph.historyUpdate()
    }

    updateIncoming() {
        var target
        if (this.uniqueOutgoing) { target = document.getElementById(this.uniqueOutgoing.uuid).querySelector("text") }
        else { target = this }
        for (var key in this.incoming) this.incoming[key].end = target
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
