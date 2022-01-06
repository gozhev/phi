package main

import (
    "fmt"
    "net/http"
    "strings"
    "text/template"
)

type Context struct {
	Token string
    Title string
    Name  string
    Fruit [3]string
}

const doc = `
<!DOCTYPE html>
<html>
    <head>
		<link rel="shortcut icon" type="image/x-icon" href="/{{.Token}}/favicon.ico"/>
		<link rel="stylesheet" href="/{{.Token}}/style/style.css" type="text/css"/>
        <title>{{.Title}}</title>
    </head>
    <body>
        <h3>Hi, {{.Name}}. The fruits are:</h3>
        <ul>
            {{range .Fruit}}
                <li>{{.}}</li>
            {{end}}
        </ul>
    </body>
</html>
`

func CheckToken(token string) bool {
	return len(token) > 0
}

func HandleRequest(w http.ResponseWriter, req *http.Request) {
	fmt.Println("url: " + req.URL.Path)
	url := req.URL.Path[1:]
	index := strings.IndexByte(url, '/') 
	if index < 0 {
		index = len(url)
	}
	token := url[:index]
	fmt.Println("token: " + token)

	if !CheckToken(token) {
		return;
	}


	w.Header().Add("Content Type", "text/html")
		templates := template.New("template")
		templates.New("doc").Parse(doc)
		context := Context{
			Token: token,
			Title: "My Fruits",
			Name: "John",
			Fruit: [3]string{"Apple", "Lemon", "Orange"},
		}
	templates.Lookup("doc").Execute(w, context)
}


func main() {
	fmt.Println("running")
    http.HandleFunc("/", HandleRequest)
    http.ListenAndServe(":8888", nil)
}
