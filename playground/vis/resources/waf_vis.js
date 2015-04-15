
// create a network
var container = document.getElementById('dependencies');

var options = {
    //stabilize: false,
    maxVelocity:  5,
    edges: {
        style: 'arrow'
    }
};


var wafNodes;
var wafTaskGens;
var wafColors;

loadJSON("./wafNodes.json",storeNodes);
loadJSON("./wafTaskGens.json",storeTaskGens);
loadJSON("./wafColors.json",storeColors);
var container = document.getElementById('dependencies');
var nodes = new vis.DataSet();
var edges = new vis.DataSet();
var data = {
    nodes: nodes,
    edges: edges
};
var network = new vis.Network(container, data, options);
// need to find a way to handle edge ids in a consistent way
//var edgeIdx=0;
//console.log(wafTaskGens);
//console.log(wafNodes);
//var tgenEdgeSeen={};

function calcVis() {
    //~ var nodes=[];
    //~ var edges=[];
    for (var ndId in wafNodes) {
        if (wafNodes[ndId]['visible'] == 'false') {
            // this node is output of the following task gens:
            //var outOfTGen=getTGenOutOf(ndId);
            // this node is input for the following task gens:
            var inForTGens=wafNodes[ndId]['in_for_tgen'];
            // connect all task gens with edges, where this node is input for one and output of another
            var outTgId=wafNodes[ndId]['out_of_tgen'];
            if (inForTGens) {
                //console.log('node: '+wafNodes[ndId]['name']+' -> inForTGens: '+inForTGens.map(function(x){return wafTaskGens[x]['name'];}).toString());
                inForTGens.map(function(n) {
                    // show the task gen
                    //wafTaskGens[n]['visible']='true'; // should be visible anyway by default
                    if (n == undefined || outTgId == undefined) {
                        return;
                    }
                    if (wafTaskGens[n]['visible'] == 'true') {
                        //console.log(wafTaskGens[n]['name']+' is visible');
                        var combi=outTgId+'_'+n;
                        //console.log(wafNodes[ndId]['name']+': '+combi);
                        if (n == outTgId) {
                            return;
                        }
                        // make sure to add the edge between 2 task gens only once
                        if (n != outTgId) {
                            // it is also possible, that n is not visible anymore, if it is has been exploded
                            edges.update({id: combi, from: outTgId, to: n});
                        }
                    }
                    else {
                        //console.log(wafTaskGens[n]['name']+' is invisible');
                        // create edges between from this task gen to the nodes of the exploded task gen
                        var relatedNodes=getNodesInForAnyOutOfTGen(n);
                        relatedNodes.map(function(m){
                            var combi=outTgId+'_'+m;
                            //console.log(wafNodes[ndId]['name']+': '+combi);
                            if (m == outTgId) {
                                return;
                            }
                            // make sure to add the edge between 2 task gens only once
                            if (m != outTgId) {
                                edges.update({id: combi, from: outTgId, to: m});
                            }
                        });
                    }
                })
            }
        }
        else {
            // this node shall be visible - can it be connected directly to its parent node or to the task gen, for which the parent is an output?
            var parents=wafNodes[ndId]['parents'];
            parents.map(function(p) {
                    if (wafNodes[p]['visible'] == 'true') {
                        var combi=ndId+'_'+p;
                        edges.update({id: combi, from: ndId, to: p});
                    }
                    else {
                        var outTgId=wafNodes[p]['out_of_tgen'];
                        if (outTgId == undefined) {
                            return;
                        }
                        var combi=ndId+'_'+outTgId;
                        //console.log(wafNodes[ndId]['name']+': '+combi);
                        if (ndId == outTgId) {
                            console.log('skipping edge: '+ndId+' == '+outTgId);
                            return;
                        }
                        // make sure to add the edge between 2 task gens only once
                        if (ndId != outTgId) {
                            edges.update({id: combi, from: ndId, to: outTgId});
                        }
                    }
                }
            )
        }
    }

    // add nodes for all visible elements
    for (var ndId in wafNodes) {
        if (wafNodes[ndId]['visible'] == 'true') {
            //console.log('node '+wafNodes[ndId]['name']+': '+wafNodes[ndId]['visible']);
            nodes.update({id: ndId, label: wafNodes[ndId]['name'], shape: "box", color: wafColors[wafNodes[ndId]['colorkey']]});
        }
        else {
            nodes.remove(ndId);
            edges.map(function(e) {
                if (e.from == ndId || e.to == ndId) {
                    edges.remove(e.id);
                }
            });
        }
    }
    for (var tgId in wafTaskGens) {
        if (wafTaskGens[tgId]['visible'] == 'true') {
            //console.log('task gen '+wafTaskGens[tgId]['name']+': '+wafTaskGens[tgId]['visible']);
            nodes.update({id: tgId, label: wafTaskGens[tgId]['name'], shape: "ellipse", color: wafColors[wafTaskGens[tgId]['colorkey']]});
        }
        else {
            nodes.remove(tgId);
            edges.map(function(e) {
                if (e.from == tgId || e.to == tgId) {
                    edges.remove(e.id);
                }
            });
        }
    }


    //network.setData(data);
    // network._updateNodes(ids, nodes)
    // network.start();
}


network.on('select', function(params) {
    document.getElementById('selection').innerHTML = params.nodes;
});
network.on('doubleClick', function(params) {
    document.getElementById('selection').innerHTML = params.nodes;
    explode_single(params.nodes);
});

function explode_single(){
    var id=document.getElementById('selection').innerHTML;
    console.log('id to explode: '+id);
    if (id == 'rootTG') {
        return;
    }
    if (id in wafTaskGens) {
        wafTaskGens[id]['visible']='false';
        //var relatedNodes=getRelatedNodesForTGen(id);
        var relatedNodes=getNodesOutOfTGen(id);
        relatedNodes.map(function(n){
            wafNodes[n]['visible']='true';
        });
        // the entire network is reorganized completely new, all elements are shifted
        // use add/remove for nodes and edges to have a smooth change
        calcVis();
    }
    else if (id in wafNodes) {
        //var relatedNodes=getRelatedNodesForTGen(id);
        var relatedNodes=wafNodes[id]['children'];
        relatedNodes.map(function(n){
            wafNodes[n]['visible']='true';
        });
        // the entire network is reorganized completely new, all elements are shifted
        // use add/remove for nodes and edges to have a smooth change
        calcVis();
    }
}

function hh() {
    calcVis();
    var ex=document.getElementById('explode_single');
    ex.onclick=explode_single;
}
window.onload=hh;

function getTGensInFor(id) {
    var result=[];
    for (var ndId in wafNodes) {
        if (id === wafNodes[ndId]['in_for_tgen']) {
            result.push(ndId);
        }
    }
    return result;
}

// get all nodes, which are input for OR output of a task gen
function getRelatedNodesForTGen(n) {
    relatedNodes=[];
    for (var o in wafNodes) {
        if (wafNodes[o]['out_of_tgen'] == n) {
            relatedNodes.push(o);
        }
        if (Array.isArray(wafNodes[o]['in_for_tgen']) && wafNodes[o]['in_for_tgen'].indexOf(n) > -1) {
            relatedNodes.push(o);
        }
    }
    console.log('getRelatedNodesForTGen('+n+'): '+relatedNodes)
    return relatedNodes;
}

// get all nodes, which are output of a task gen
function getNodesOutOfTGen(n) {
    relatedNodes=[];
    for (var o in wafNodes) {
        if (wafNodes[o]['out_of_tgen'] == n) {
            relatedNodes.push(o);
        }
    }
    console.log('getNodesOutOfTGen('+n+'): '+relatedNodes)
    return relatedNodes;
}

// get all output-nodes of a task gen, which are input for any other task gen
function getNodesInForAnyOutOfTGen(n) {
    relatedNodes=[];
    for (var o in wafNodes) {
        if (wafNodes[o]['out_of_tgen'] == n) {
            var f=false;
            for (var m in wafTaskGens) {
                if (Array.isArray(wafNodes[o]['in_for_tgen']) && wafNodes[o]['in_for_tgen'].indexOf(m) > -1 && n != m) {
                    f=true;
                    break;
                }
            }
            if (f) {
                relatedNodes.push(o);
            }
        }
    }
    console.log('getNodesInForAnyOutOfTGen('+n+'): '+relatedNodes)
    return relatedNodes;
}

function storeNodes(wafNodesJSON) {
    wafNodes=wafNodesJSON
}
function storeTaskGens(wafTaskGensJSON) {
    wafTaskGens=wafTaskGensJSON
}
function storeColors(wafColorsJSON) {
    wafColors=wafColorsJSON
}

function loadJSON(path, success, error) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                success(JSON.parse(xhr.responseText));
            }
            else {
                error(xhr);
            }
        }
    };
    // for now, use synchronous request: false
    xhr.open("GET", path, false);
    xhr.send();
}