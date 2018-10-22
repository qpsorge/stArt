let fs = require("fs");

let Map =  require("./Map");

fs.readFile("version5points.osm", "utf-8", (error, data) => {
    a = new Date().getTime();

    let map = new Map(data);
    let matrix = map.createMatrix();

    for(let i = 0; i < matrix.length; i++)
    {
        let l = "";
        for(let u = 0; u < matrix[i].length; u++)
        {
            if(matrix[i][u] == null)
            {
                    l += "null | "
            }
            else 
                l += matrix[i][u].id+":"+matrix[i][u].x+";"+matrix[i][u].y+" | ";
        }
        console.log(l);
    }

    b = new Date().getTime();
    console.debug(b-a);
}); // on a la matrice avec id, (x; y)


//PARTIE 2
//Reconnaissance forme matrice
// je regarde juste si les vecteur ont la meme orientation, pas si ils ont la meme grandeur, ce qui laisse plus de possibilité pour des formes un peu déformées
/*
matrice de la map : matrix
matrice du dessin : matrixDrawing
*/

let matrixDrawing=new Array();
let matrixTest=new Array(); // de la taille de matrixDrawing

let n=8;
for(let r=0;r<n;r++)    //pour n rotations de 2 * pi / n à chaque fois
    {
    //pour tous les elements de matrix drawing, faire une rotation de ses elements
    rotationMatrix(matrix,r,theta=3.1415926/8)
        //et tester la correspondance
        for(let j=0; j<matrixDrawing.Length;j++)                  // pour toutes les elements de la matrice Dessin
            {
                for(let k=0; k<matrixDrawing.Length;k++)         
                {
                    for(let i = 0; i < matrix.length; i++)      // Et pour ceux de la matrice de openstreetMap
                    {
                        for(let u = 0; u < matrix[i].length; u++) 
                        {
                            if(map.isColinear(matrix[i][u],matrixDrawing[j][k]))  //On regarde si les vecteurs sont colinéaires
                            {
                                matrixTest[j][k]=true;           // si oui, on ajoute true dans la matrice et on passe a la prochaine ligne/colonne
                                continue;
                            }
                        }       
                        console.log(l);
                    }
                }
            }
        }

if (map.isTrue(matrixDrawing))                      //si on a trouvé une corrélation dessin / map ( matrice remplie de true)
    Console.debug("You have a match ! :)");
    //faire l'affichage graphique
else
    Console.debug("Maybe, next time .. :D Try another picture")
    //proposer une liste avec d'autres formes




            

