include make.mk/make.mk

$.go = go build

$(go_binary)
	name = phi
	srcs = main.go
$;
