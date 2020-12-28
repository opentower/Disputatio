var $ = require("jquery")
var Gen = require("./generic-map-classes")

class DebateMap extends Gen.GenericMap {

    constructor() { 
        super() 
        this.frame.addEventListener('click',this.handleClick)
    }

    handleClick(e) {
        let theMap = this.map
        if (theMap.focalNode && e.target.mapNode && e.shiftKey) { //holding shift makes the click manipulate arrows.
            let targetNode = e.target.mapNode
            if (targetNode.uuid in theMap.focalNode.outgoing) { 
                if (theMap.focalNode.valence == "pro") { //turn support into denial
                    theMap.focalNode.valence = "con"
                } else { 
                    theMap.removeEdge(theMap.focalNode,targetNode) //or remove denial
                    theMap.focalNode.clearIncoming() //also remove incoming edges
                    theMap.focalNode.valence = null
                }
            } else if (targetNode != theMap.focalNode) { //otherwise draw an arrow if the target is eligible
                if (theMap.focalNode.isAssertion) {
                    theMap.focalNode = theMap.createCluster(theMap.focalNode)
                    theMap.createEdge(theMap.focalNode, targetNode)
                    theMap.focalNode.valence = "pro"
                } else if (theMap.focalNode.isClusterNode && targetNode.cluster != theMap.focalNode ) {
                    theMap.focalNode.clearOutgoing() //remove old outgoing
                    theMap.focalNode.clearIncoming() //also remove incoming edges
                    theMap.createEdge(theMap.focalNode, targetNode)
                    theMap.focalNode.valence = "pro"
                }
            } 
            theMap.focalNode.updateIncoming()
        } else if (e.target.mapNode) {
            if (e.target.mapNode.cluster && e.target.mapNode.cluster.parentNode == theMap.surface) {//without shift, click updates focus
                theMap.focalNode = e.target.mapNode.cluster
            } else if (e.target.mapNode.parentNode == theMap.surface) { 
                theMap.focalNode = e.target.mapNode
            }
        }
    }

    createCluster(node) {
        let cluster = new Cluster(); 
        cluster.initAttach(this,node.left,node.top)
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
            let cluster = new Cluster(savednode.config)
            cluster.initAttach(this, savednode.left, savednode.top)
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
    constructor(config) {
        super(config)
        if (this.config.implicit) this.implicit = true
        else this.implicit = false
        $(this).on("dragstart",_=> this.style.zIndex = 50)
        $(this).on("dragstop",_=> this.style.zIndex = 5)
        this.isAssertion = true
        this.dragStop = this.dragStopDefault
        this.touchEnd = this.dragStopDefault
        this.input = document.createElement("textarea");
        this.input.mapNode = this
    }

    connectedCallback() {
        super.connectedCallback()
        this.classList.add("assertionNode")
        this.appendChild(this.input)
    }

    initAttach(parent,x,y) {
        super.initAttach(parent,x,y)
        this.input.rows = 1
        if (this.config.value) {
            this.input.value = this.config.value
            this.input.style.width = Math.min(200, Math.max(50, this.calcInputWidth() + 15)) + "px"
        } else {
            this.input.style.width = "50px"
        }
        this.input.style.height = this.input.scrollHeight + 'px'
        this.input.focus()
    }

    set implicit (val) { 
        if (val) {
            this.classList.add("implicit")
            this.implicitContent = true
        } else {
            this.classList.remove("implicit")
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

    calcInputWidth() { 
        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        var fontFam = $(this.input).css("font-family"); 
        var fontSize = $(this.input).css("font-size"); 
        var fontString = fontSize + ' ' + fontFam
        context.font = fontString
        var metrics = context.measureText(this.input.value);
        return metrics.width;
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

    connectedCallback() {
        super.connectedCallback()
        this.input.addEventListener('input', e => {
            clearTimeout(this.inputTimeout)
            this.input.style.height = 'auto'
            this.input.style.width = Math.min(200, Math.max(50, this.calcInputWidth() + 15)) + "px"
            this.input.style.height = this.input.scrollHeight + 'px'
            this.inputTimeout = setTimeout(_ => this.map.changed(),250) 
        })
        this.input.addEventListener('focusout', _ => { 
            if (this.input.value == "") this.detach() 
        })
    }

}

export class ImmutableAssertion extends Assertion {

    connectedCallback() {
        super.connectedCallback()
        this.addEventListener('keydown', e => {
            if (e.key == "Backspace") this.detach()
            e.preventDefault() 
        })
    }
}

export class Cluster extends Gen.GenericNode {

    constructor(config) {
        super(config);
        this.nodes = {}
        this.isClusterNode = true

        this.emptyObserver = new MutationObserver(t => {
            if (Object.keys(this.nodes).length == 0) this.detach() 
        })
        this.emptyObserver.observe(this, {subtree:true, childList: true})
        this.clusterContents = document.createElement("div");
        this.classList.add("clusterNode")
        $(this).on("dragstart", _ => this.style.zIndex = 50)
        $(this).on("dragstop", _ => { 
            this.style.zIndex = 1
            this.repel()
        })
    }

    connectedCallback() {
        super.connectedCallback()
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
        node.touchStart =  _ => {
            let rect = this.map.getBoundingClientRect()
            node.touchOffset = {x : this.left + node.offsetLeft, y : this.top + node.offsetTop}
        }
        let checkDetach = e => { 
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
                this.removeNode(node)
                this.map.focalNode = node
            }
            this.map.focalNode = this
            this.map.redrawEdges();
            this.map.changed()
        }
        node.dragStop = checkDetach
        node.touchEnd = checkDetach
    }

    removeNode(node) {
        let borderwidth = parseInt(getComputedStyle(this).borderWidth)
        let relOffsetLeft = node.offsetLeft + borderwidth
        let relOffsetTop = node.offsetTop + borderwidth
        node.style.position = "absolute"
        node.initDrag(1) //resume translation
        this.map.surface.appendChild(node) //reattach to map
        node.left = relOffsetLeft + this.left
        node.top = relOffsetTop + this.top
        delete node.cluster
        delete this.nodes[node.uuid] //delete from node list
        node.dragStart = _ => { }
        node.touchStart = _ => { }
        node.dragStop = node.dragStopDefault
        node.touchEnd = node.dragStopDefault
        delete node.touchOffset
        this.map.redrawEdges();
        this.map.changed()
    }

    get uniqueOutgoing() {
        let outgoingKey = Object.keys(this.outgoing)[0]
        if (outgoingKey) { return this.outgoing[outgoingKey] }
        else { return null }
    }

    get valence() { return this.dataset.valence }

    set valence(s) {
        this.dataset.valence = s
        for (var key in this.outgoing) this.outgoing[key].valence = s
        this.map.changed()
    }

    updateIncoming() {
        var target
        if (this.uniqueOutgoing) { target = this.map.shadow.getElementById(this.uniqueOutgoing.uuid).querySelector("text") }
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
        let node = new ImmutableAssertion(config); 
        node.initAttach(this,x,y)
        this.focalNode = node
        this.changed()
        return node
    }

    fromJSON(json) {
        let obj = JSON.parse(json)
        for (var key in obj.nodes) if (obj.nodes[key].role == "assertion") {
            let savednode = obj.nodes[key]
            let node = new ImmutableAssertion(savednode.config)
            node.initAttach(this, savednode.left, savednode.top)
        }
        super.fromJSON(json)
    }
}

export class FreeformDebateMap extends DebateMap {

    constructor() { super() }

    handleClick (e) {
        if (e.target == this && !e.altKey) { 
            let rect = this.map.surface.getBoundingClientRect()
            let zoom = this.map.transform.scale
            this.map.createAssertion((e.clientX - rect.left - 20)/zoom, (e.clientY - rect.top - 20)/zoom) 
        } 
        else { super.handleClick(e) }
    }

    createAssertion(x,y,config) { 
        let node = new MutableAssertion(config); 
        node.initAttach(this,x,y);
        this.focalNode = node
        this.changed()
        return node
    }

    fromJSON(json) {
        let obj = JSON.parse(json)
        for (var key in obj.nodes) if (obj.nodes[key].role == "assertion") {
            let savednode = obj.nodes[key]
            let node = new MutableAssertion(savednode.config)
            node.initAttach(this, savednode.left, savednode.top)

        }
        super.fromJSON(json)
    }
}

export class KeyboardFreeformDebateMap extends DebateMap {

    constructor() { super() }

    createAssertion(x,y,config) { 
        let node = new MutableAssertion(config); 
        node.initAttach(this,x,y)
        this.addBinds(node)
        this.focalNode = node
        this.changed()
        return node
    }

    nodeAbove(node) {
        let pos
        let rect = node.getBoundingClientRect()
        if (node.cluster) pos = node.cluster  // if the node is clustered, we use that for positioning
        else pos = node
        let support = this.createAssertion(pos.left - 10, pos.top - 200, {})
        //we need to set a value to make sure the support node isn't cleared during clustering
        support.input.value = " "
        this.focalNode = this.createCluster(support)
        this.createEdge(this.focalNode, node)
        this.focalNode.valence = "pro"
        this.focalNode.repel()
        support.input.value = "" 
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
        //we need to set a value to make sure the support node isn't cleared during clustering
        statement.input.value = " "
        cluster.addNode(statement)
        cluster.repel() 
        statement.input.value = "" 
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
            let node = new MutableAssertion(savednode.config)
            node.initAttach(this, savednode.left, savednode.top)
            this.addBinds(node)
        }
        super.fromJSON(json)
    }
}
