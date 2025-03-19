(let [empty? (fn [list] (= (count list) 0))
      maphead (fn rec [f list]
                (if (empty? list)
                  list
                  (cons (f (peek list)) (pop list))))]
  (print (maphead (fn [x] (+ x 2)) (quote (1 2 3)))))