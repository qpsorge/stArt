var parser = require('fast-xml-parser');

class Node
{
    constructor(node)
    {
        this.id = node["@_id"];
        this.latitude = parseFloat(node["@_lat"]);
        this.longitude = parseFloat(node["@_lon"]);
    }
}

class Relation
{
    constructor(path,node1,node2)
    {
        this.path=path;
        this.node1=node1;
        this.node2 = node2;
    }
}

class Path
{
    constructor(way, nodes)
    {
        this.id = way["@_id"];
        this.name = null;

        if(way.tag != null)
        {
            if(Array.isArray(way.tag) == false)
                way.tag = [way.tag];
            let i = 0;
            while(i < way.tag.length)
            {
                let tag = way.tag[i];
                if(tag["@_k"] == "name")
                    this.name = tag["@_v"];
                else if(tag["@_k"]== "waterway")
                    throw new Error("waterway");
                i++;
            }
        }
        console.log(this.name);
        this.related = [];
        this.nodes = way.nd.map((ref) => {
            return new Node(nodes[ref["@_ref"]]);
        });
    }

    calculateIntersections(path, thisIndex, pathIndex)
    {
        /*
        But when intersection does not occur often, a better way probably is to reverse these steps:

        express the straight lines in the form of y = ax + b (line passing A,B) and y = cx + d (line passing C,D)
        see if C and D are on the same side of y = ax+b
        see if A and B are on the same side of y = cx+d
        if the answer to the above are both no, then there is an intersection. otherwise there is no intersection.
        find the intersection if there is one.

        Note: to do step 2, just check if (C.y - a(C.x) - b) and (D.y - a(D.x) - b) have the same sign. Step 3 is similar. Step 5 is just standard math from the two equations.
        */

        //https://www.google.com/maps/place/44%C2%B050'22.6%22N+0%C2%B034'13.8%22W/@44.840071,-0.5727825,18z/data=!4m6!3m5!1s0x0:0x0!7e2!8m2!3d44.8396045!4d-0.5705079

        for(let i = 0; i < this.nodes.length -1; i++)
        {
            for(let u = 0; u < path.nodes.length -1; u++)
            {
                let A = this.nodes[i];
                let B = this.nodes[i+1];
                let C = path.nodes[u];
                let D = path.nodes[u+1];

                let a = 0;
                if(B.longitude - A.longitude != 0)
                    a = (B.latitude - A.latitude) / (B.longitude - A.longitude);
                let b = A.latitude - a * A.longitude;

                let c = 0;
                if(D.longitude - C.longitude != 0)
                    c = (D.latitude - C.latitude) / (D.longitude - C.longitude);
                let d = C.latitude - c * C.longitude;

                if(a - c == 0) // On ignore, c'est la même droite, ou deux fonctions constantes ie parallèles
                    continue;

                let CDside = C.latitude - a * C.longitude - b * D.latitude - a * D.longitude - b > 0;
                let Abside = A.latitude - c * A.longitude - d * B.latitude - c * B.longitude - d > 0;

                if(CDside == false && Abside == false)
                {
                    let longitude = ((d - b) / (a - c));
                    let latitude = a * longitude + b;


                    let distA = Math.abs(longitude-A.longitude) + Math.abs(latitude - A.latitude);
                    let distB = Math.abs(longitude-B.longitude) + Math.abs(latitude - B.latitude);
                    let distAB = Math.abs(B.longitude-A.longitude) + Math.abs(B.latitude - A.latitude);

                    if(distA > distAB || distB > distAB)
                        continue;

                    let distC = Math.abs(longitude-C.longitude) + Math.abs(latitude - C.latitude);
                    let distD = Math.abs(longitude-D.longitude) + Math.abs(latitude - D.latitude);
                    let distCD = Math.abs(D.longitude-C.longitude) + Math.abs(D.latitude - C.latitude);

                    if(distC > distCD || distD > distCD)
                        continue;


                    console.debug("Intersecion de "+this.name+"/"+path.name+" en "+(latitude)+","+(longitude));

                    let nd1 = new Node({
                        "@_id" : "Intersect1_"+longitude+"-"+latitude,
                        "@_lat" : latitude,
                        "@_lon" : longitude
                    });

                    let nd2 = new Node({
                        "@_id" : "Intersect2_"+longitude+"-"+latitude,
                        "@_lat" : latitude,
                        "@_lon" : longitude
                    });

                    this.nodes.splice(i+1, 0, nd1);
                    i++; // on avance pour ne pas créer de boucle infinie
                    
                    path.nodes.splice(u+1, 0, nd2);
                    u++; // on avance pour ne pas créer de boucle infinie

                    let r1=new Relation(pathIndex,i, u);
                    let r2=new Relation(thisIndex,u, i);

                    this.related.push(r1);
                    path.related.push(r2);


                }

            }
        }
    }

    static CreateIntersections(paths)
    {
        for(let i = 0; i < paths.length; i++)
        {
            let path1 = paths[i];
            for(let u = paths.length-1; u > 0; u--)
            {
                // Optimisation, pas besoin de calculer path1 => path2 ET path2 => path1
                if(i > paths.length /2 && u < paths.length < 2)
                    break;
                let path2 = paths[u];
                if(path1 == path2 || path1.name == path2.name)
                    continue;
                path1.calculateIntersections(path2, i, u);
            }
        }
    }
}

class Map
{
    constructor(xml)
    {
        this.raw = parser.parse(xml, {
            "ignoreAttributes" : false
        });
        let nodes = {}; // on consctruit un dictionnaire pour accéder aux noeuds directement par leur adresse à l'avenir
        this.raw.osm.node.forEach(node => {
            nodes[node["@_id"]] = node;
        });
        this.paths = this.raw.osm.way.map((way) => {
            try
            {
                 return new Path(way, nodes);
            }
            catch(e)
            {
                console.debug(e);
                if(e.message=="waterway"){
                    console.debug('WATERWAY');
                    return null;
                }
                throw e;
            }

        });
        this.paths=this.paths.filter((path) => {
            if(path==null)
                return false;
            return true;

        });
        // TEST
        /*this.paths = this.paths.filter((path) => {
            if(path.name == null || (path.name.indexOf("Devise") == -1 && path.name.indexOf("Pas") == -1))
                return false;
            return true;
        }); */
        Path.CreateIntersections(this.paths);
        console.debug("Done");
    }

    createMatrix()
    {
        let size = 0;
        this.paths.forEach((path) => {
            size += path.nodes.length;
        });
        let matrix = new Array(size);
        for(let u = 0; u < size; u++)
        {
            matrix[u] = new Array(size);
        }
        console.debug("Matrix de "+size+"x"+size);

        // construction de la matrice adjacence primaire
        let index = 0;
        this.paths.forEach((path) => {
            for(let i = 0; i < path.nodes.length - 1; i++)
            {
                let A = path.nodes[i];
                let B = path.nodes[i+1];
                let dx = B.longitude - A.longitude;
                let dy = B.latitude - A.latitude;
                matrix[index+i][index+i+1] = {
                    "x" : dx,
                    "y" : dy,
                    "id" : B.id
                };
                matrix[index+i+1][i+index] = {
                    "x" : -dx,
                    "y" : -dy,
                    "id" : A.id   
                };
            }
            index += path.nodes.length;
        });
        
        // Copie des neuds identiques optimisation possible, on delete la ligne en double au lieu de copier size fois
        index = 0;
        this.paths.forEach((path) => {
            path.related.forEach((relation) => {
                let otherIndex = relation.path + relation.node2;
                for(let i = 0; i < size; i++)
                {
                    if(matrix[otherIndex][i] != null && matrix[index+relation.node1][i] == null)
                    {
                        matrix[index+relation.node1][i] = matrix[otherIndex][i]; // ligne
                        matrix[i][index+relation.node1] = matrix[i][otherIndex]; // colonne

                    }
                }
            });
            index+= path.nodes.length;
        });
        /*
        // Ajout des colinéaires 
        let nb = 0;
        for(let i = 0; i < size; i++) //ligne
        {
            for(let u = 0; u < size; u++) // optimisation possible: parcours de la moitié de la matrice //colonne
            {
                if(matrix[i][u] == null)
                    continue;
                let v1 = matrix[i][u];
                for(let o = 0; o < size; o++)
                {
                    if(matrix[u][o] == null)
                        continue;
                    let v2 = matrix[u][o];
                    if((v1.x == -v2.x && v1.y == -v2.y) || isColinear(v1, v2) == false)
                        continue;
                    nb ++;
                    let v = {
                        "x" : v1.x + v2.x,
                        "y" : v1.y + v2.y 
                    };
                    matrix[i][o] = v;
                    //console.debug("Colinéaire "+v.x+" "+v.y);
                    matrix[o][i] = {
                        "x" : -v.x,
                        "y" : -v.y   
                    };
                }
            }
        }
        console.debug("Done "+nb+" colinéaires");*/
        return matrix;
    }

}





function isColinear(vector1, vector2, epsilon=0.000000000000059){ // 0.000059
   /* //on pourrait aussi procéder par déterminant
    let a=vector1.x;
    let b=vector1.y;
    let c=vector2.x;
    let d=vector2.y;
    // vector1 est en (x1,y1) je normalise sa composante en x =>(1,y1/x1)
    let rapport1=b/Math.abs(a);
    //je fais la meme transformation a vector2 (1,y2/x2)
    let rapport2=d/Math.abs(c);
    if(rapport1<=rapport2+epsilon && rapport1>=rapport2-epsilon) // si ils sont sensiblement colinaires (composante en y reduite, de distance < epsilon)
    {
        return true;                                            //on retourne vrai
    }
    else
    {
        return false;                                           //Sinon on retourne faux
    }*/
    let a=vector1.x;
    let b=vector1.y;
    let c=vector2.x;
    let d=vector2.y;

    let determinant=a*d-b*c;

    if(determinant <= epsilon && determinant>=-epsilon) // si ils sont sensiblement colinaires (aire de determinant presque nulle)
    {
        return true;                                            //on retourne vrai
    }
    else
    {
        return false;                                           //Sinon on retourne faux
    }

}

function isTrue(matrix)
    {
        // test si on a trouvé la forme :
    let test = true;
    for(let j=0; j<matrix.Length;j++)                  // pour toutes les lignes de la matrice dessin
    {
        for(let k=0; k<matrix.Length;k++)         // pour toutes les colonnes de la matrice dessin
        {
            if(matrixTest!=true)
                test=false;
        }
    }
    if(test==true)
        return true;
    }

function rotationMatrix(matrix,r,theta=2*3.1415926/8)
    {
        for(let j=0; j<matrix.Length;j++)                  // pour tous les elements de la matrice:
                {
                    for(let k=0; k<matrix.Length;k++)         
                    {
                        matrix[j][k]=produitMatriciel2x2(r*theta,matrix[j][k]); // on suppose que matrix[j][k] est un vecteur array (x;y) où matrix[j][k][0]=x et matrix[j][k][1]=y
                    }                                                           // on fait la rotation de r * theta ou theta=pi/8 et r varie entre 0 et 8
                }
    }

function produitMatriciel2x2(theta,M2)
    {
        // M1 matrice de rotation, M2 matrice colonne 2lignes, 1colonne
        /*
        M=( cos(theta)  -sin(theta) )       M2=( x )
        ( sin(theta)   cos(theta) )          ( y )
        */
        let M1= new Array(); // pas forcement utile mais bon pour le fun et la comprehension
        M1[0][0]=cos(theta);
        M1[0][1]=-sin(theta);
        M1[1][0]=sin(theta);
        M1[1][1]=cos(theta);

        let matrix=new Array(); //matrice resultat sous forme matrix=(xRotaté;yRotaté) c est pas francais mais on me comprend :p
        matrix[0]=M1[0][0]*x+M1[0][1]*y;
        matrix[1]=M1[1][0]*x+M1[1][1]*y;
        
        return matrix;
    }


module.exports = Map;
