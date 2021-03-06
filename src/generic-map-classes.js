var $ = require("jquery")
var panzoom = require("panzoom")
require("jquery-ui/ui/widgets/draggable")
var RelativeLine = require("./graphical-classes.js")
var genericMapCss = require("./generic-map.css").default.toString()

// This is an event to track changes, used for example is pushing to the undo
// stack.
var changed = new Event('changed')

//These functions are used in calculating overlap
function leftOverlap (r1,r2) {return (r1.x <= r2.x) && (r1.x + r1.width >= r2.x)}
function topOverlap (r1,r2) {return (r1.y <= r2.y) && (r1.y + r1.height >= r2.y)}
function overlap (r1,r2) {
    return (leftOverlap(r1,r2) || leftOverlap(r2,r1))
        && (topOverlap(r1,r2)  || topOverlap(r2,r1))
}

// This is a buildingblock class for various graph widgets, with edges and
// node-focus. It provides mechanisms for tracking and maintaining state,
// but should be neutral on which kinds of nodes are in the graph, and on how
// one interacts with the graph
export class GenericMap extends HTMLElement {
    constructor() {
        super();
        this.focalNodeContent = null //initialize focal node content
        this.nodes = {}              //initialize table of nodes
        this.edges = {}              //initialize table of edges
        this.history = []
        this.future = []
        this.present = JSON.stringify(this)
        this.historyLock = false
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg')
        this.svg.classList.add("svg")
        this.frame = document.createElement("div")
        this.frame.classList.add("frame")
        this.surface = document.createElement("div")
        this.surface.classList.add("surface")
        this.stylesheet = document.createElement("style")
        this.initialized = false

        this.addEventListener("changed", _ => this.updateHistory())
        this.addEventListener('dragover', e => e.preventDefault())
        this.addEventListener('touchmove', e => e.preventDefault())
        this.shadow = this.attachShadow({mode: 'open'})
    }

    connectedCallback() {
        // per WHATWG spec 4.13.2, styling and attaching children should be deferred until attached to the DOM
        if (!this.initialized) { //initializing on first attach
            this.frame.map = this
            this.stylesheet.innerHTML = genericMapCss
            this.shadow.appendChild(this.stylesheet)
            this.shadow.appendChild(this.frame)
            this.frame.appendChild(this.surface)
            this.surface.appendChild(this.svg)
            this.zoom = panzoom(this.surface, {
                zoomSpeed: 0.1,
                zoomDoubleClickSpeed: 1,
                onDoubleClick : _ => { return false },
                beforeWheel: e => { return !(e.target.classList.contains("frame")) },
                beforeMouseDown: e => { return !(e.target.classList.contains("frame")) },
                onTouch: e => { 
                    return false 
                }
            })
            this.style.border = "1px solid"
            this.style.display = 'inline-block'
            this.style.position = 'relative'
            this.style.overflow = 'hidden'
            this.style.touchAction = 'manipulation'
            this.initialized = true
        }
    }

    changed() { this.dispatchEvent(changed) }

    updateHistory() {
        setTimeout(_ => {
            if (!this.historyLock) {
                let present = JSON.stringify(this)
                let change = this.present != present
                if (change) { 
                    this.history.push(this.present) 
                    this.present = present
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
        while (this.surface.lastChild.tagName != "svg") this.surface.removeChild(this.surface.lastChild)
        this.edges = {}
        this.nodes = {}
    }

    redrawEdges() { 
        for (var key in this.edges) this.edges[key].updatePosition() 
    }

    toJSON () { 
        return {
            nodes: this.nodes,
            focus: this.focalNode,
        }
    }

    set focalNode(n) { 
        if (this.focalNode) { this.focalNodeContents.classList.remove('focalNode') }
        this.focalNodeContents = n
        if (this.focalNode) { this.focalNodeContents.classList.add('focalNode') }
        this.redrawEdges()
    }

    get focalNode() { return this.focalNodeContents }
        
    get transform() { return this.zoom.getTransform() }

    createEdge(n1,n2) {
        var line
        if (n2.isClusterNode && n2.uniqueOutgoing) {
            line = new RelativeLine(n1, n2.uniqueOutgoing.label, this)
        } else { 
            line = new RelativeLine(n1, n2, this)
        }
        line.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.edges[line.uuid] = line
        n1.outgoing[n2.uuid] = line
        n2.incoming[n1.uuid] = line
        line.path.id = line.uuid
        this.changed()
    }

    fromJSON() { throw "Deserialization is not yet supported generically" }

    removeEdge(n1,n2) {
        if (n1 && n2) {
            let line = n1.outgoing[n2.uuid]
            delete this.edges[line.uuid]
            delete n1.outgoing[n2.uuid]
            delete n2.incoming[n1.uuid]
            line.remove()
        }
        this.changed()
    }

    contains(node) {
        let containers = []
        let rect = node.getBoundingClientRect()
        for (var key in this.nodes) {
            let val = this.nodes[key]
            let rect1 = val.getBoundingClientRect()
            if (overlap(rect,rect1) && val != node) containers.push(val)
        }
        return containers
    }
}

export class GenericNode extends HTMLElement {
    constructor(config) {
        super();
        if (config) this.config = config 
        else this.config = {}
        if (this.config.uuid) this.uuid = this.config.uuid
        else this.uuid = Math.random().toString(36).substring(2) //generate unique identifier
        this.incoming = {} //initialize table of incoming edges
        this.outgoing = {} //initialize table of outgoing edges
        this.bg = document.createElement("div"); //initialize background div
        this.initialized = false
        this.bg.mapNode = this
        this.resizeObserver = new ResizeObserver(_ => this.repel())
        this.resizeObserver.observe(this)
        this.dragStart = _ => {}
        this.dragStop = _ => {}
        this.touchStart = _ => {}
        this.initDrag()
        this.translationFactor = 1
        $(this).on("dragstart", _ => { this.dragStart() })
        $(this).on("dragstop", _ => { this.dragStop() })
        $(this).on("touchstart", _ => { this.touchStart() })
        $(this).on("touchend", _ => {if (this.dragged) { this.dragStop(); this.dragged = false }})
        $(this).on("dragstop", _ => { this.map.changed() })
        $(this).on("touchend", _ => { this.map.changed() })
        $(this).on("touchmove", e => { 
            this.dragged = true
            e.stopPropagation()
            e.preventDefault()
            let trans = this.map.transform
            let clientX = e.touches[0].clientX
            let clientY = e.touches[0].clientY
            let scrollLeft = this.map.frame.scrollLeft
            let scrollTop = this.map.frame.scrollTop
            let maprect = this.map.getBoundingClientRect()
            let thisrect = this.getBoundingClientRect()
            let  offset = { x: 0, y: 0 } 
            if (this.touchOffset) { 
                offset = { x : this.touchOffset.x, y : this.touchOffset.y } 
            }
            this.left = (clientX - maprect.x - trans.x - thisrect.width + scrollLeft) / trans.scale - offset.x - 15
            this.top = (clientY - maprect.y  - trans.y - thisrect.height + scrollTop) / trans.scale - offset.y- 15
            this.map.redrawEdges()
        })
    }

    connectedCallback() {
        if (!this.initialized) {
            this.classList.add("genericNode")
            this.style.position = 'absolute' 
            //position is overridden by panzoom and switched around a lot,
            //hence set here rather than in the css.
            this.appendChild(this.bg)
            this.initialized = true
        }
    }

    initAttach (parent,x,y) {
        this.map = parent
        this.map.nodes[this.uuid] = this //register in the map
        this.left = x
        this.top = y
        this.attach(parent)
    }

    initDrag () { 
        //need to reinitialize the drag object when reattaching the node
        //when dragging, need to translate when attached to map, and not otherwise
        $(this).draggable({
            start: function(event, ui) {
                ui.position.left = 0
                ui.position.top = 0
                this.skip = true
            },
            drag: function(event, ui) {
                    let trans = this.map.transform
                    let scrollLeft = this.map.frame.scrollLeft
                    let scrollTop = this.map.frame.scrollTop
                    let changeLeft = ui.position.left - (ui.originalPosition.left + ((trans.x - scrollLeft )* this.translationFactor) ); // find change in left
                    let newLeft = ui.originalPosition.left + changeLeft / trans.scale; // adjust new left by our zoomScale
                    let changeTop = ui.position.top - (ui.originalPosition.top + ((trans.y - scrollTop) * this.translationFactor) ); // find change in top
                    let newTop = ui.originalPosition.top + changeTop / trans.scale; // adjust new top by our zoomScale
                    ui.position.left = newLeft;
                    ui.position.top = newTop;
                window.requestAnimationFrame(_ => {
                    //skip first redraw to avoid odd position-flash associated with start event
                    if (!this.skip) { this.map.redrawEdges() } 
                    else (this.skip = false)
                })
            },
        });
    };

    clearOutgoing() { for (var key in this.outgoing) this.map.removeEdge(this,this.map.nodes[key]) }

    clearIncoming() { for (var key in this.incoming) this.map.removeEdge(this.map.nodes[key],this) }

    detach() {
        this.clearOutgoing()
        this.clearIncoming()
        if (this.cluster) delete this.cluster.nodes[this.uuid]; //delete from nodes if in cluster
        delete this.map.nodes[this.uuid] //delete from map
        if (this.parentNode) this.parentNode.removeChild(this); //remove if parent exists
        if (this.map.focalNode == this) this.map.focalNode = null
    }

    repel(filter) {
        if (!filter) filter = _ => {return true}
        let rect = this.getBoundingClientRect()
        for (var key in this.map.nodes) {
            let val = this.map.nodes[key]
            let rect1 = val.getBoundingClientRect()
            if (filter(val) && val != this && overlap(rect,rect1)) {
                if (rect1.x + (rect1.width/2) > rect.x + (rect.width/2)) val.left = val.left + 50
                else val.left = (val.left - 50)
                val.repel()
            }
        }
        this.map.redrawEdges()
    }

    attach(parent) { parent.surface.appendChild(this); }

    get top() { return parseInt(this.style.top) }
 
    set top(y) { this.style.top = y + "px" }

    get left() { return parseInt(this.style.left) }

    set left(x) { this.style.left = x + "px" }

    toJSON() { 
        return { 
            config: {
                uuid: this.uuid,
            },
            incoming: Object.keys(this.incoming),
            outgoing: Object.keys(this.outgoing),
            top: this.top,
            left: this.left,
            role: "none",
        }
    }
}
