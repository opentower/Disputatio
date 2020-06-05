export class Analysis extends HTMLElement {
    constructor() {
        super();
        let observer = new MutationObserver((mutList,obs) => mutList.forEach(mut => this.update(mut, obs)))
        observer.observe(this, {subtree:true, characterData: true, childList: true})
        window.addEventListener('load', _ => this.initDeco())
    }

    initDeco() {
        let working = true
        let recur = function(node) {
            let children = node.childNodes
            children.forEach(n => {
                if (n.nodeType == Node.TEXT_NODE) {
                    if (n.data.match(/{[^]*?\|[^]*?}/)) working = true
                    Analysis.decorate(n)
                } else { recur(n) }
            })
        }
        while (working) {
            working = false
            recur(this)
        }
    }

    update (mut, obs) {
        if (mut.type == 'characterData') {
            obs.disconnect()
            Analysis.decorate(mut.target)
            obs.observe(this, {subtree:true, characterData: true, childList: true})
        } 
    }

    static decorate (cnode) {
        let parts = cnode.data.split(/{([^]*?)\|([^]*?)}([^]*)/)
        if (parts.length > 1) {
            let prem = new PremiseSpan(parts[1],parts[2])
            cnode.deleteData(0,cnode.length - parts[3].length)
            cnode.before(prem)
            prem.before(parts[0])
        }
    }
}

export class PremiseSpan extends HTMLElement {
    constructor(text,content) {
        super();
        this.isPremise = true
        this.innerHTML = text
        this.content = content.replace(/\s+/gm," ") || "no content"
        this.title = this.content
        this.alt = this.content
        this.contentEditable = false
        this.style.background = "#deeff5"
        this.style.borderRadius = "7px"
        this.style.paddingLeft = "5px"
        this.style.paddingRight = "5px"
        this.addEventListener('dragstart', this.dragHandler)
        this.draggable = true
    }

    dragHandler(e) {
        e.dataTransfer.setData("application/disputatio",this.content)
        e.dataTransfer.dropEffect = "move"
    }
}
