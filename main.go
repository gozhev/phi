package main

import (
	"github.com/bradfitz/gomemcache/memcache"
//	"encoding/json"
	"io/ioutil"
    "fmt"
    "bytes"
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

var g_memc *memcache.Client

func CheckToken(token string) bool {
	cached_token, err := g_memc.Get("token")
	if err != nil {
		fmt.Println(err)
		return false
	}
	return token == string(cached_token.Value)
}

func JanusTokenAdd(token string) {
	req := []byte("{\"janus\":\"add_token\",\"token\":\"" + token + "\",\"transaction\":\"1\",\"admin_secret\":\"janusoverlord\",\"plugins\":[\"janus.plugin.streaming\"]}");

	_, err := http.Post("http://localhost:51101/admin", "application/json",
        bytes.NewBuffer(req))

	if err != nil {
		fmt.Println(err)
		return;
	}
	//body, _ := ioutil.ReadAll(resp.Body)
	//fmt.Println(string(body))
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
		JanusTokenAdd(token)

		w.Header().Add("Content Type", "text/html")


		data, err := ioutil.ReadFile("data/template/template.html")
		doc := string(data)
		if (err != nil) {
			fmt.Println(err)
		}


		templates := template.New("template")
		templates.New("doc").Parse(doc)
		context := Context{
			Token: token,
		}
		templates.Lookup("doc").Execute(w, context)
		return
	}

	filename := "data" + url
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		fmt.Println(err) 
	} else {
		if (strings.HasSuffix(filename, ".css")) {
			w.Header().Set("Content-Type", "text/css")
		} else if (strings.HasSuffix(filename, ".js")) {
			w.Header().Set("Content-Type", "text/javascript")
		}
		w.Write(data)
	}
}


func main() {
	g_memc = memcache.New("127.0.0.1:11211")

	fmt.Println("running")
    http.HandleFunc("/", HandleRequest)
    http.ListenAndServe(":51000", nil)
}

// vim:set ts=4 sw=4 noet:
