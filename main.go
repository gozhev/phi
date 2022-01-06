package main

import (
	"github.com/bradfitz/gomemcache/memcache"
	"io/ioutil"
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

var g_doc string
var g_memc *memcache.Client

func CheckToken(token string) bool {
	cached_token, err := g_memc.Get("token")
	if err != nil {
		fmt.Println(err)
		return false
	}
	return token == string(cached_token.Value)
}

func HandleRequest(w http.ResponseWriter, req *http.Request) {
	url := req.URL.Path[1:]
	index := strings.IndexByte(url, '/') 
	if index < 0 {
		index = len(url)
	}
	token := url[:index]

	if !CheckToken(token) {
		fmt.Println("invalid token: " + token)
		return;
	}

	url = url[index:]

	if len(url) <= 1 {
		w.Header().Add("Content Type", "text/html")

		templates := template.New("template")
		templates.New("doc").Parse(g_doc)
		context := Context{
			Token: token,
		}
		templates.Lookup("doc").Execute(w, context)
		return
	}

	if strings.HasPrefix(url, "/script/") {
		filename := "data" + url
		data, err := ioutil.ReadFile(filename)
		if err != nil {
			fmt.Println(err) 
		} else {
			w.Write(data)
		}
	}
}


func main() {
	data, err := ioutil.ReadFile("data/template/template.html")
	g_doc = string(data)
	if (err != nil) {
		fmt.Println(err)
	}

	g_memc = memcache.New("127.0.0.1:11211")

	fmt.Println("running")
    http.HandleFunc("/", HandleRequest)
    http.ListenAndServe(":50001", nil)
}

// vim:set ts=4 sw=4 noet:
