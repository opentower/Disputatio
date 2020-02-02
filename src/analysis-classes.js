export class Analysis extends HTMLElement {
    constructor() {
        super();
        let observer = new MutationObserver((mutList,obs) => mutList.forEach(mut => this.decorate(mut, obs)))
        observer.observe(this, {subtree:true, characterData: true, childList: true})
        console.log("constructed")
    }

    decorate (mut, obs) {
        if (mut.type == 'characterData') {
            let parts = mut.target.data.split(/{(.*)\|(.*)}/)
            if (parts.length > 1) {
                obs.disconnect()
                mut.target.deleteData(0,mut.target.length - parts[3].length)
                let prem = new PremiseSpan()
                prem.innerHTML = parts[1]
                prem.content = parts[2]
                mut.target.before(prem)
                prem.before(parts[0])
                obs.observe(this, {subtree:true, characterData: true, childList: true})
            }
        } 
    }
}

export class PremiseSpan extends HTMLElement {
    constructor() {
        super();
        this.contentEditable = false
        this.content = "no content"
        this.style.background = "lightblue"
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
