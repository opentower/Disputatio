function subPrems(obj1,obj2,e1,e2) {
    var test
    for (var key1 of e1.nodes) {
        test = false
        for (var key2 of e2.nodes) {
            if (obj1.nodes[key1].config.value == obj2.nodes[key2].config.value) {
                test = true
                break
            }
        }
        if (!test) break
    }
    return test
}

function eqEdge(obj1,obj2,e1,e2,uuid1,uuid2) {
    let samePrems = subPrems(obj1,obj2,e1,e2) && subPrems(obj2,obj1,e2,e1)
    let sameValence = e1.valence == e2.valence
    let o1 = e1.outgoing
    let o2 = e2.outgoing
    var sameConc
    if (o1.length == 0) { sameConc = o2.length == 0 }
    else if (o2.length > 0 ) {
        let n1 = obj1.nodes[o1]
        let n2 = obj2.nodes[o2]
        //XXX:cleanup. relies on JS treating [[x]] as equivalent to [x], since
        //e.outgoing is an array.
        if (n1.role == "assertion" && n2.role == "assertion") {
             sameConc = n1.config.value == n2.config.value 
        } else if (n1.role == "cluster" && n2.role == "cluster") {
             if (!uuid1) uuid1 = e1.config.uuid
             if (!uuid2) uuid2 = e2.config.uuid
             if (n1.config.uuid == uuid1) uuid1 = "looped" //detect a loop.
             if (n2.config.uuid == uuid2) uuid2 = "looped"
             if (uuid1 == "looped" && uuid2 == "looped") sameConc = true
             else sameConc = eqEdge(obj1, obj2, n1, n2,uuid1,uuid2)
        } else { sameConc = false }
    } else { sameConc = false }
    return samePrems && sameConc && sameValence
}

export function subTest(json1,json2) {
    let obj1 = JSON.parse(json1)
    let obj2 = JSON.parse(json2)
    var isContained = true
    for (var key1 in obj1.nodes) {
        let e1 = obj1.nodes[key1]
        isContained = false
        if (e1.role == "cluster") {
            for (var key2 in obj2.nodes) if (obj2.nodes[key2].role == "cluster") {
                let e2 = obj2.nodes[key2]
                isContained = eqEdge(obj1,obj2,e1,e2)
                if (isContained) break
            }
        } else if (e1.role == "assertion") {
            for (var key2 in obj2.nodes) if (obj2.nodes[key2].role == "assertion") {
                let e2 = obj2.nodes[key2]
                isContained = e1.config.value == e2.config.value
                if (isContained) break
            }
        }
        if (!isContained) break
    }
    return isContained
}
