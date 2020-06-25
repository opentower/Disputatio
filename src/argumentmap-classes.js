var $ = require("jquery")
var Gen = require("./generic-map-classes")

class DebateMap extends Gen.GenericMap {

    constructor() { 
        super() 
        this.addEventListener('click',this.handleClick)
    }

    handleClick(e) {
        if (this.focalNode && e.target.mapNode && e.shiftKey) { //holding shift makes the click manipulate arrows.
            let targetNode = e.target.mapNode
            if (targetNode.uuid in this.focalNode.outgoing) { 
                if (this.focalNode.valence == "pro") { //turn support into denial
                    this.focalNode.valence = "con"
                } else { 
                    this.removeEdge(this.focalNode,targetNode) //or remove denial
                    this.focalNode.clearIncoming() //also remove incoming edges
                    this.focalNode.valence = null
                }
            } else if (targetNode != this.focalNode) { //otherwise draw an arrow if the target is eligible
                if (this.focalNode.isAssertion) {
                    this.focalNode = this.createCluster(this.focalNode)
                    this.createEdge(this.focalNode, targetNode)
                    this.focalNode.valence = "pro"
                } else if (this.focalNode.isClusterNode && targetNode.cluster != this.focalNode ) {
                    this.focalNode.clearOutgoing() //remove old outgoing
                    this.focalNode.clearIncoming() //also remove incoming edges
                    this.createEdge(this.focalNode, targetNode)
                    this.focalNode.valence = "pro"
                }
            } 
            this.focalNode.updateIncoming()
        } else if (e.target.mapNode) {
            if (e.target.mapNode.cluster && e.target.mapNode.cluster.parentNode == this.surface) {//without shift, click updates focus
                this.focalNode = e.target.mapNode.cluster
            } else if (e.target.mapNode.parentNode == this.surface) { 
                this.focalNode = e.target.mapNode
            }
        }
    }

    createCluster(node) {
        let cluster = new Cluster(this,node.left,node.top); 
        cluster.addNode(node)
        this.changed()
        return cluster
    }

    fromJSON(json) {
        //child class should do the work of recovering the assertions
        let obj = JSON.parse(json)
        // cluster them
        for (var key in obj.nodes) if (obj.nodes[key].role == "cluster") {
            let savednode = obj.nodes[key]
            let cluster = new Cluster(this, savednode.left, savednode.top, savednode.config)
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
}

export class Assertion extends Gen.GenericNode {
    constructor(parent,x,y,config) {
        if (!config) config = {}
        super(parent,x,y,config)
        if (config.implicit) this.implicit = true
        else this.implicit = false
        this.style.zIndex = 5
        $(this).on("dragstart",_=> this.style.zIndex = 50)
        $(this).on("dragstop",_=> this.style.zIndex = 5)
        this.isAssertion = true
        this.dragStop = this.dragStopDefault
        this.input = document.createElement("textarea");
        this.input.style.position = 'relative'
        this.input.cols = 5
        this.input.rows = 1
        this.input.style.border = 'none'
        this.input.mapNode = this
    }

    set implicit (val) { 
        if (val) {
            this.style.borderStyle = "dashed"
            this.implicitContent = true
        } else {
            this.style.borderStyle = "solid"
            this.implicitContent = false
        }
    }

    get implicit () { return this.implicitContent }

    dragStopDefault() {
        for (var v of this.map.contains(this)) {
            if (v.isClusterNode) { v.addNode(this); return}
        }
        for (var v of this.map.contains(this)) {
            if (v.isAssertion) { this.map.createCluster(v).addNode(this); return}
        }
    }
    
    repel() { 
        super.repel(val => {
            if (this.cluster && val.cluster) { val.cluster != this.cluster } // do not repel your own siblings
            else if (this.cluster) { return val != this.cluster } //or your own cluster
            else { return !val.cluster } // only repel unclustered nodes
        })
    }

    toJSON() {
        let obj = super.toJSON()
        obj.role = "assertion"
        obj.config.value = this.input.value
        obj.config.implicit = this.implicit
        return obj
    }

}


export class MutableAssertion extends Assertion {
    constructor(parent,x,y,config) {
        super(parent,x,y,config)
        if (!config) config = {}
        if (config.value) {
            this.input.value = config.value
            this.input.cols = Math.min(15,Math.max(5,config.value.length))
        } else {
            this.input.addEventListener('input', e => {
                clearTimeout(this.inputTimeout)
                this.input.style.height = 'auto'
                this.input.cols = Math.min(15,Math.max(5,this.input.value.length))
                this.input.style.height = this.input.scrollHeight + 'px'
                this.inputTimeout = setTimeout(_ => this.map.changed(),250) 
            })
        }
        this.appendChild(this.input);
        this.input.style.height = this.input.scrollHeight + 'px'
        this.input.addEventListener('focusout', _ => { 
            if (this.input.value == "") this.detach() 
        })
        this.input.focus()
    }
}

export class ImmutableAssertion extends Assertion {
    constructor(parent,x,y,config) {
        super(parent,x,y,config)
        if (!config) config = {}
        if (config.value) {
            this.input.value = config.value
            this.input.cols = Math.min(15,Math.max(5, config.value.length))
        }
        this.addEventListener('keydown', e => {
            if (e.key == "Backspace") this.detach()
            e.preventDefault() 
        })
        this.appendChild(this.input);
        this.input.style.height = this.input.scrollHeight + 'px'
        this.input.focus()
    }
}

export class Cluster extends Gen.GenericNode {

    constructor(parent,x,y,config) {
        super(parent,x,y,config);
        if (!config) config = {}
        this.nodes = {}
        this.isClusterNode = true
        this.valenceContent = null

        this.emptyObserver = new MutationObserver(t => {
            if (Object.keys(this.nodes).length == 0) this.detach() 
        })
        this.emptyObserver.observe(this, {subtree:true, childList: true})
        this.clusterContents = document.createElement("div");
        this.style.zIndex = 1
        $(this).on("dragstart", _ => this.style.zIndex = 50)
        $(this).on("dragstop", _ => { 
            this.style.zIndex = 1
            this.repel()
        })
        this.appendChild(this.clusterContents);
    }

    addNode(node) {
        this.clusterContents.appendChild(node)
        this.map.focalNode = this
        //relativize position and drag behavior
        node.style.position = "relative" 
        node.top = 0 
        node.left = 0
        node.initDrag(0)
        this.nodes[node.uuid] = node //add to node list
        node.cluster = this
        node.dragStart = _ => {
            node.dragOffset = {x : node.offsetLeft, y : node.offsetTop}
        }
        node.dragStop = (e,ui) => { 
            if (this.map.contains(node).includes(this)) {
                this.addNode(node) 
            } else {
                for (var v of this.map.contains(node)) {
                    if (v.isClusterNode) {
                        this.removeNode(node)
                        v.addNode(node)
                        return
                    }
                }
                for (var v of this.map.contains(node)) { 
                    if (v.isAssertion) { 
                        this.removeNode(node)
                        let cluster = node.map.createCluster(v)
                        cluster.addNode(node)
                        
                        return
                    }
                }
                this.removeNode(node,ui)
                this.map.focalNode = node
            }
            this.map.focalNode = this
            this.map.redrawEdges();
            this.map.changed()
        }
    }

    removeNode(node,ui) {
        node.style.position = "absolute"
        node.initDrag(1) //resume translation
        this.map.surface.appendChild(node) //reattach to map
        if (ui) { 
            node.top = ui.position.top + node.cluster.top + node.dragOffset.y
            node.left = ui.position.left + node.cluster.left + node.dragOffset.x
        }
        node.cluster = null
        delete this.nodes[node.uuid] //delete from node list
        node.dragStop = node.dragStopDefault
        this.map.redrawEdges();
        this.map.changed()
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
            this.style.borderColor = "green"
            for (var key in this.outgoing) this.outgoing[key].color = "green"
        } else if (s == "con") {
            this.style.borderColor = "red"
            for (var key in this.outgoing) this.outgoing[key].color = "red"
        } else {
            this.style.borderColor = "gray"
        }
        this.map.changed()
    }

    updateIncoming() {
        var target
        if (this.uniqueOutgoing) { target = document.getElementById(this.uniqueOutgoing.uuid).querySelector("text") }
        else { target = this }
        for (var key in this.incoming) this.incoming[key].end = target
    }

    //only reply unclustered nodes
    repel() { super.repel(val => { return !val.cluster }) }

    toJSON () {
        let obj = super.toJSON()
        obj.role = "cluster"
        obj.nodes = Object.keys(this.nodes)
        obj.valence = this.valence
        return obj
    }
}

export class ScaffoldedDebateMap extends DebateMap {

    constructor() { 
        super() 
        this.addEventListener('drop', e => {
            e.preventDefault(); 
            let data = e.dataTransfer.getData("application/disputatio")
            let rect = this.surface.getBoundingClientRect()
            let zoom = this.transform.scale
            this.createAssertion((e.clientX - rect.left)/zoom, (e.clientY - rect.top)/zoom, {value: data})
        })
    }

    createAssertion(x,y,config) { 
        let node = new ImmutableAssertion(this,x,y,config); 
        this.focalNode = node
        this.changed()
        return node
    }

    fromJSON(json) {
        let obj = JSON.parse(json)
        for (var key in obj.nodes) if (obj.nodes[key].role == "assertion") {
            let savednode = obj.nodes[key]
            new ImmutableAssertion(this, savednode.left, savednode.top, savednode.config)
        }
        super.fromJSON(json)
    }
}

export class FreeformDebateMap extends DebateMap {

    constructor() { super() }

    handleClick (e) {
        if (e.target == this) { 
            let rect = this.surface.getBoundingClientRect()
            let zoom = this.transform.scale
            this.createAssertion((e.clientX - rect.left - 20)/zoom, (e.clientY - rect.top - 20)/zoom) 
        } 
        else { super.handleClick(e) }
    }

    createAssertion(x,y,config) { 
        let node = new MutableAssertion(this,x,y,config); 
        this.focalNode = node
        this.changed()
        return node
    }

    fromJSON(json) {
        let obj = JSON.parse(json)
        for (var key in obj.nodes) if (obj.nodes[key].role == "assertion") {
            let savednode = obj.nodes[key]
            new MutableAssertion(this, savednode.left, savednode.top, savednode.config)
        }
        super.fromJSON(json)
    }
}

export class KeyboardFreeformDebateMap extends DebateMap {

    constructor() { super() }

    createAssertion(x,y,config) { 
        let node = new MutableAssertion(this,x,y,config); 
        this.addBinds(node)
        this.focalNode = node
        this.changed()
        return node
    }

    nodeAbove(node) {
        let pos
        let rect = node.getBoundingClientRect()
        if (node.cluster)  pos = node.cluster  // if the node is clustered, we use that for positioning
        else pos = node
        let support = this.createAssertion(pos.left - 10, pos.top - 200, {})
        this.focalNode = this.createCluster(support)
        this.createEdge(this.focalNode, node)
        this.focalNode.valence = "pro"
        this.focalNode.repel()
        support.input.focus()
        return this.focalNode
    }

    nodeBeside(node) { 
        let pos
        if (node.cluster)  pos = node.cluster  // if the node is clustered, we use that for positioning
        else pos = node
        let rect = node.getBoundingClientRect()
        let statement = this.createAssertion((pos.left + rect.width + 50), pos.top , {})
        statement.repel()
    }

    nodeWithin(cluster) {
        let statement = this.createAssertion(0, 0, {})
        cluster.addNode(statement)
        cluster.repel() 
        statement.input.focus()
        statement.repel()
    }

    addBinds(node) {
        node.addEventListener('keydown', e => {
            if (node.input.value != "") {
                if (e.key == "Tab") {
                    if (node.cluster) this.nodeWithin(node.cluster)
                    else this.nodeBeside(node)
                    e.preventDefault() 
                }
                if (e.key == "Enter" || (e.key == "s" && e.altKey)) {
                    this.nodeAbove(node)
                    e.preventDefault() 
                }
                if (e.key == "o" && e.altKey) {
                    this.nodeAbove(node).valence = "con"
                    e.preventDefault() 
                }
                if (e.key == "t" && e.altKey) {
                    node.implicit = !node.implicit
                    this.changed()
                    e.preventDefault() 
                }
                if (e.key == "d" && e.ctrlKey) {
                    this.nodeBeside(node)
                    e.preventDefault() 
                }
            } else if (e.key == "Tab" || e.key == "Enter") { 
                e.preventDefault() 
            }
        })
    }

    fromJSON(json) {
        let obj = JSON.parse(json)
        for (var key in obj.nodes) if (obj.nodes[key].role == "assertion") {
            let savednode = obj.nodes[key]
            let node = new MutableAssertion(this, savednode.left, savednode.top, savednode.config)
            this.addBinds(node)
        }
        super.fromJSON(json)
    }
}
