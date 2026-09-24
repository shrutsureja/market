package main

import (
	"log"
	"net/http"
	"os"

	"github.com/shrut-sureja/fpi-flow-dashboard/internal/httpapi"
	"github.com/shrut-sureja/fpi-flow-dashboard/internal/reports"
)

func main() {
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}
	repo, err := reports.NewFileRepository(dataDir)
	if err != nil {
		log.Fatal(err)
	}
	handler := httpapi.New(repo, dataDir)
	log.Printf("FPI Flow API listening on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
